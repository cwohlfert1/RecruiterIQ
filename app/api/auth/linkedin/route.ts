import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// GET /api/auth/linkedin
// Initiates LinkedIn OAuth flow. User must already be authenticated via Supabase.
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const origin      = new URL(req.url).origin
  const redirectUri = `${origin}/api/auth/linkedin/callback`
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
    client_id:     process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri:  redirectUri,
    state,
    scope:         'openid profile email',
  })

  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
  )
}
