import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/projects/[id]/candidates/[candidateId]/flag
// Body: { flag_type: 'catfish' | 'dnu' | 'watch', reason?: string }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; candidateId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Verify project access + get agency owner
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title, project_members(user_id, role)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find((m: { user_id: string }) => m.user_id === user.id)
  const isOwner      = project.owner_id === user.id
  const callerRole   = callerMember?.role ?? (isOwner ? 'owner' : null)

  if (!callerRole) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const body = await req.json().catch((err) => { console.error('[flag] JSON parse error:', err); return {} })
  const { flag_type, reason } = body as { flag_type: string; reason?: string }

  if (!['catfish', 'dnu', 'watch'].includes(flag_type)) {
    return NextResponse.json({ error: 'Invalid flag_type' }, { status: 400 })
  }

  // Fetch candidate
  const { data: candidate } = await supabase
    .from('project_candidates')
    .select('id, candidate_name, candidate_email')
    .eq('id', params.candidateId)
    .eq('project_id', params.id)
    .single()

  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get agency owner ID (the owner of this project's agency)
  const agencyOwnerId = project.owner_id

  // Insert into flagged_candidates (agency-wide DNU registry)
  await admin.from('flagged_candidates').upsert({
    agency_owner_id:   agencyOwnerId,
    candidate_email:   candidate.candidate_email,
    candidate_name:    candidate.candidate_name,
    flag_type,
    reason:            reason ?? null,
    flagged_by:        user.id,
    source_project_id: params.id,
  }, { onConflict: 'agency_owner_id,candidate_email' })

  // Update flag_type on project_candidates row
  await supabase
    .from('project_candidates')
    .update({ flag_type })
    .eq('id', params.candidateId)

  // Log activity
  await admin.from('project_activity').insert({
    project_id:    params.id,
    user_id:       user.id,
    action_type:   'candidate_flagged',
    metadata_json: {
      candidate_name: candidate.candidate_name,
      flag_type,
      reason: reason ?? null,
    },
  })

  return NextResponse.json({ success: true, flag_type })
}
