import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_SEATS = 5 // owner + 4 invites
const INVITE_TTL_DAYS = 7

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    // ── Plan check: agency only ───────────────────────────────────────────
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan_tier')
      .eq('user_id', user.id)
      .single()

    if (profile?.plan_tier !== 'agency') {
      return NextResponse.json({ error: 'Agency plan required' }, { status: 403 })
    }

    const { email } = await req.json() as { email: string }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // ── Seat count check (owner counts as 1 seat) ─────────────────────────
    const admin = createAdminClient()
    const { count } = await admin
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', user.id)
      .in('status', ['pending', 'active'])

    // owner occupies seat 1; max invites = MAX_SEATS - 1
    if ((count ?? 0) >= MAX_SEATS - 1) {
      return NextResponse.json(
        {
          error: 'seat_limit',
          message: "You've reached your 5-seat limit. Contact us to discuss enterprise pricing.",
        },
        { status: 422 }
      )
    }

    // ── Prevent duplicate active invites ─────────────────────────────────
    const { data: existing } = await admin
      .from('team_members')
      .select('id, status')
      .eq('owner_user_id', user.id)
      .eq('invited_email', normalizedEmail)
      .in('status', ['pending', 'active'])
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: existing.status === 'active' ? 'Member already on team' : 'Invite already pending' },
        { status: 409 }
      )
    }

    // ── Create invite token ───────────────────────────────────────────────
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS)

    await admin.from('team_members').insert({
      owner_user_id: user.id,
      invited_email: normalizedEmail,
      invite_token: token,
      invite_expires_at: expiresAt.toISOString(),
      status: 'pending',
    })

    // ── Send invite email via Supabase auth invite ────────────────────────
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${token}`
    await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: inviteUrl,
      data: { invite_token: token, invited_by: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[team/invite]', err)
    return NextResponse.json({ error: 'Invite failed' }, { status: 500 })
  }
}
