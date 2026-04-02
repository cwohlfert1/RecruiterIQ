import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/flags
// Body: { candidate_email, candidate_name, flag_type, reason? }
// Flags a candidate agency-wide without requiring a specific project/candidate context

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Must be manager role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { candidate_email, candidate_name, flag_type, reason } =
    body as { candidate_email?: string; candidate_name?: string; flag_type?: string; reason?: string }

  if (!candidate_email || !candidate_name || !flag_type) {
    return NextResponse.json({ error: 'candidate_email, candidate_name, and flag_type are required' }, { status: 400 })
  }

  if (!['catfish', 'dnu', 'watch'].includes(flag_type)) {
    return NextResponse.json({ error: 'Invalid flag_type' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await admin.from('flagged_candidates').upsert({
    agency_owner_id: user.id,
    candidate_email: candidate_email.trim().toLowerCase(),
    candidate_name:  candidate_name.trim(),
    flag_type,
    reason:          reason?.trim() || null,
    flagged_by:      user.id,
  }, { onConflict: 'agency_owner_id,candidate_email' })

  return NextResponse.json({ success: true, flag_type })
}
