import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// Derive the public-facing base URL.
// Railway sets RAILWAY_PUBLIC_DOMAIN or we fall back to NEXT_PUBLIC_APP_URL,
// then to request origin (works for local dev).
function getBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  const { protocol, host } = new URL(req.url)
  return `${protocol}//${host}`
}

// GET /api/auth/linkedin
// Initiates LinkedIn OAuth flow. User must already be authenticated via Supabase.
export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (!process.env.LINKEDIN_CLIENT_ID) {
    return NextResponse.redirect(
      new URL('/dashboard/settings/profile?linkedin=error&reason=not_configured', req.url),
    )
  }

  const base        = getBaseUrl(req)
  const redirectUri = `${base}/api/auth/linkedin/callback`
  const state       = crypto.randomBytes(16).toString('hex')

  // Store state + userId in cookie (10 min expiry)
  const cookieStore = cookies()
  cookieStore.set('li_oauth_state', JSON.stringify({ state, userId: user.id }), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   600,
    path:     '/',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.LINKEDIN_CLIENT_ID,
    redirect_uri:  redirectUri,
    state,
    scope:         'openid profile email',
  })

  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
  )
}
