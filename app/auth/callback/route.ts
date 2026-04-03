import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Log the Supabase callback URL once on startup so it can be confirmed in LinkedIn app settings.
// This must be the ONLY redirect URI registered in the LinkedIn Developer App.
console.log(
  '[auth/callback] LinkedIn app authorized redirect URI must be:',
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`,
)

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // After exchange, check if user authenticated via linkedin_oidc and sync profile data
      const { data: { user } } = await supabase.auth.getUser()
      const linkedInIdentity = user?.identities?.find(i => i.provider === 'linkedin_oidc')

      if (user && linkedInIdentity) {
        const meta = user.user_metadata ?? {}
        const updates: Record<string, string | null> = {
          linkedin_id:           linkedInIdentity.id ?? null,
          linkedin_connected_at: new Date().toISOString(),
          // LinkedIn OIDC puts profile data in user_metadata
          avatar_url:    (meta.avatar_url ?? meta.picture ?? null) as string | null,
          display_name:  (meta.full_name  ?? meta.name    ?? null) as string | null,
          linkedin_url:  meta.iss === 'https://www.linkedin.com'
            ? null  // sub is opaque; URL not reliably available via OIDC
            : null,
        }
        // Remove nulls for fields we don't want to overwrite
        const safeUpdates = Object.fromEntries(
          Object.entries(updates).filter(([, v]) => v !== undefined)
        )

        const admin = createAdminClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('user_profiles').update(safeUpdates).eq('user_id', user.id)

        // Redirect back to profile page with success indicator
        const profileUrl = new URL('/dashboard/settings/profile', origin)
        profileUrl.searchParams.set('linkedin', 'connected')
        return NextResponse.redirect(profileUrl.toString())
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Exchange failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
