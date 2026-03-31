import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const { memberId } = await req.json() as { memberId: string }
    if (!memberId) {
      return NextResponse.json({ error: 'memberId required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // ── Verify ownership before mutating ─────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = admin as any
    const { data: member } = await adminDb
      .from('team_members')
      .select('id, owner_user_id, status')
      .eq('id', memberId)
      .single() as { data: { id: string; owner_user_id: string; status: string } | null }

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    if (member.owner_user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (member.status === 'removed') {
      return NextResponse.json({ error: 'Member already removed' }, { status: 409 })
    }

    // ── Set status to removed — history is retained ───────────────────────
    await adminDb
      .from('team_members')
      .update({ status: 'removed' })
      .eq('id', memberId)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[team/remove]', err)
    return NextResponse.json({ error: 'Remove failed' }, { status: 500 })
  }
}
