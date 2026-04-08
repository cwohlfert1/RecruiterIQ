import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { isWhitelistedEmail } from '@/lib/whitelist'
import { isSafeRedirect } from '@/lib/security/validate'

// Log the Supabase callback URL once on startup so it can be confirmed in LinkedIn app settings.
// This must be the ONLY redirect URI registered in the LinkedIn Developer App.
console.log(
  '[auth/callback] LinkedIn app authorized redirect URI must be:',
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`,
)

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Security: validate redirect path to prevent open redirect attacks
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = isSafeRedirect(rawNext) ? rawNext : '/dashboard'

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

      // Send welcome email for new email/password signups (not OAuth)
      const isNewUser = user && !linkedInIdentity && (
        Date.now() - new Date(user.created_at).getTime() < 5 * 60 * 1000
      )
      if (isNewUser && user?.email) {
        const whitelisted = isWhitelistedEmail(user.email)

        // Grant free Agency access to whitelisted domains
        if (whitelisted) {
          const adminWl = createAdminClient()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (adminWl as any).from('user_profiles').update({
            plan_tier: 'agency',
            subscription_status: 'active',
          }).eq('user_id', user.id)
        }

        try {
          const resend = new Resend(process.env.RESEND_API_KEY ?? '')
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin

          if (whitelisted) {
            // Whitelisted welcome email
            await resend.emails.send({
              from: 'Candid.ai <hello@candidai.app>',
              to:   user.email,
              subject: 'Welcome to Candid.ai — Your Agency access is ready',
              html: `
                <div style="font-family:Inter,sans-serif;background:#0D0F1C;color:#f8fafc;max-width:600px;margin:0 auto;padding:40px 32px;border-radius:16px">
                  <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 8px">Welcome to Candid.ai</h1>
                  <p style="color:#94a3b8;margin:0 0 24px;font-size:15px;line-height:1.6">
                    You have full Agency access as part of our beta program — no credit card needed.
                  </p>
                  <p style="color:#94a3b8;margin:0 0 12px;font-size:15px;line-height:1.6">Here's what you can do right now:</p>
                  <ul style="color:#cbd5e1;font-size:14px;line-height:2;padding-left:20px;margin:0 0 28px">
                    <li><strong>Resume Scorer</strong> — paste a JD + resume and get an instant CQI score</li>
                    <li><strong>Boolean Generator</strong> — build targeted LinkedIn/Indeed search strings</li>
                    <li><strong>Projects</strong> — track candidates through your pipeline</li>
                    <li><strong>Spread Tracker</strong> — manage your contractor placements and margin</li>
                    <li><strong>Stack Ranking</strong> — compare candidates head-to-head</li>
                  </ul>
                  <a href="${appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px">
                    Open Dashboard →
                  </a>
                  <p style="color:#475569;font-size:12px;margin:32px 0 0;line-height:1.6">
                    We'd love your feedback — reply directly to <a href="mailto:wohlbuiltventures@gmail.com" style="color:#6366f1">wohlbuiltventures@gmail.com</a> with anything you notice.
                  </p>
                </div>
              `,
            })
          } else {
            // Standard welcome email
            await resend.emails.send({
              from: 'Candid.ai <hello@candidai.app>',
              to:   user.email,
              subject: 'Welcome to Candid.ai — your sourcing co-pilot is ready',
              html: `
                <div style="font-family:Inter,sans-serif;background:#0D0F1C;color:#f8fafc;max-width:600px;margin:0 auto;padding:40px 32px;border-radius:16px">
                  <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 8px">Welcome to Candid.ai</h1>
                  <p style="color:#94a3b8;margin:0 0 24px;font-size:15px;line-height:1.6">
                    Your AI-powered recruiting co-pilot is ready. Here's what you can do right now:
                  </p>
                  <ul style="color:#cbd5e1;font-size:14px;line-height:2;padding-left:20px;margin:0 0 28px">
                    <li>Create a project and paste your job description</li>
                    <li>Add candidates and get instant CQI scores</li>
                    <li>Generate Boolean strings for LinkedIn & Indeed</li>
                    <li>Send skill + trust assessments to shortlisted candidates</li>
                  </ul>
                  <a href="${appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px">
                    Open Dashboard →
                  </a>
                  <p style="color:#475569;font-size:12px;margin:32px 0 0;line-height:1.6">
                    You're on the free plan. Upgrade anytime for unlimited scoring and team collaboration.<br>
                    Questions? Reply to this email — we read every one.
                  </p>
                </div>
              `,
            })
          }
        } catch {
          // Welcome email failure is non-blocking
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Exchange failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
