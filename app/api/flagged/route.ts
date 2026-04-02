import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// GET /api/flagged — returns all flagged_candidates for this agency owner

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Must be manager
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: flags, error } = await admin
    .from('flagged_candidates')
    .select('id, candidate_email, candidate_name, flag_type, reason, flagged_by, source_project_id, created_at')
    .eq('agency_owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve flagged_by emails
  const flaggedByIds = Array.from(new Set((flags ?? []).map((f: { flagged_by: string }) => f.flagged_by))) as string[]
  const emailMap: Record<string, string> = {}

  await Promise.all(flaggedByIds.map(async (uid: string) => {
    if (uid === user.id && user.email) {
      emailMap[uid] = user.email
    } else {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data?.user?.email) emailMap[uid] = data.user.email
    }
  }))

  const enriched = (flags ?? []).map((f: {
    id: string
    candidate_email: string
    candidate_name: string
    flag_type: string
    reason: string | null
    flagged_by: string
    source_project_id: string | null
    created_at: string
  }) => ({
    ...f,
    flagged_by_email: emailMap[f.flagged_by] ?? null,
  }))

  return NextResponse.json({ flags: enriched })
}

// DELETE /api/flagged?id=... — remove a flag

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin
    .from('flagged_candidates')
    .delete()
    .eq('id', id)
    .eq('agency_owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
