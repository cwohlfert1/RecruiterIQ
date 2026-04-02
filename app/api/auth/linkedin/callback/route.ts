import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

interface LinkedInUserInfo {
  sub:            string
  name:           string
  given_name?:    string
  family_name?:   string
  picture?:       string
  email:          string
  email_verified?: boolean
  headline?:      string
}

// GET /api/auth/linkedin/callback
export async function GET(req: NextRequest) {
  const url          = new URL(req.url)
  const base         = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? url.origin
  const code         = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')
  const errorParam   = url.searchParams.get('error')

  const settingsUrl  = `${base}/dashboard/settings/profile`

  // LinkedIn returned an error (e.g. user cancelled)
  if (errorParam) {
    return NextResponse.redirect(`${settingsUrl}?linkedin=error&reason=${errorParam}`)
  }

  if (!code || !returnedState) {
    return NextResponse.redirect(`${settingsUrl}?linkedin=error&reason=missing_params`)
  }

  // Verify state cookie
  const cookieStore = cookies()
  const rawCookie   = cookieStore.get('li_oauth_state')?.value
  if (!rawCookie) {
    return NextResponse.redirect(`${settingsUrl}?linkedin=error&reason=state_expired`)
  }

  let stored: { state: string; userId: string }
  try {
    stored = JSON.parse(rawCookie)
  } catch {
    return NextResponse.redirect(`${settingsUrl}?linkedin=error&reason=state_invalid`)
  }

  if (stored.state !== returnedState) {
    return NextResponse.redirect(`${settingsUrl}?linkedin=error&reason=state_mismatch`)
  }

  // Clear state cookie
  cookieStore.delete('li_oauth_state')

  // Exchange code for access token
  const redirectUri = `${base}/api/auth/linkedin/callback`
  let accessToken: string
  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
        client_id:     process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    })
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`)
    const tokenData = await tokenRes.json() as { access_token: string }
    accessToken = tokenData.access_token
  } catch {
    return NextResponse.redirect(`${settingsUrl}?linkedin=error&reason=token_exchange`)
  }

  // Fetch LinkedIn profile via OpenID Connect userinfo
  let liProfile: LinkedInUserInfo
  try {
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`)
    liProfile = await profileRes.json() as LinkedInUserInfo
  } catch {
    return NextResponse.redirect(`${settingsUrl}?linkedin=error&reason=profile_fetch`)
  }

  // Update user_profiles with LinkedIn data
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('user_profiles')
    .update({
      avatar_url:            liProfile.picture ?? null,
      display_name:          liProfile.name ?? null,
      linkedin_id:           liProfile.sub,
      linkedin_url:          `https://www.linkedin.com/in/${liProfile.sub}`,
      linkedin_connected_at: new Date().toISOString(),
    })
    .eq('user_id', stored.userId)

  if (error) {
    return NextResponse.redirect(`${settingsUrl}?linkedin=error&reason=save_failed`)
  }

  return NextResponse.redirect(`${settingsUrl}?linkedin=connected`)
}
