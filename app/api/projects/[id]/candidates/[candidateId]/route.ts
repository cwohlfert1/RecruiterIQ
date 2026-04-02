import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { CandidateStatus, ProjectActivityType } from '@/types/database'

const VALID_STATUSES: CandidateStatus[] = ['reviewing', 'screening', 'submitted', 'rejected']

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; candidateId: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Fetch candidate + verify project membership
  const { data: candidate, error: candError } = await supabase
    .from('project_candidates')
    .select('id, project_id, status, candidate_name')
    .eq('id', params.candidateId)
    .eq('project_id', params.id)
    .is('deleted_at', null)
    .single()

  if (candError || !candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify project access
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: memberRow } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', params.id)
    .eq('user_id', user.id)
    .single()

  const isOwner = project.owner_id === user.id
  const role    = memberRow?.role as string | undefined
  const canEdit = isOwner || role === 'owner' || role === 'collaborator'
  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { status?: unknown; assessment_invite_id?: unknown; deleted_at?: unknown; resume_file_url?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if ('status' in body) {
    if (!VALID_STATUSES.includes(body.status as CandidateStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
  }

  if ('assessment_invite_id' in body) {
    updates.assessment_invite_id = body.assessment_invite_id ?? null
  }

  if ('deleted_at' in body && body.deleted_at === 'now') {
    updates.deleted_at = new Date().toISOString()
  }

  if ('resume_file_url' in body && typeof body.resume_file_url === 'string') {
    updates.resume_file_url = body.resume_file_url
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('project_candidates')
    .update(updates)
    .eq('id', params.candidateId)

  if (updateError) return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 })

  // Log relevant activity
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  if ('status' in updates && updates.status !== candidate.status) {
    await admin.from('project_activity').insert({
      project_id:    params.id,
      user_id:       user.id,
      action_type:   'candidate_status_changed' satisfies ProjectActivityType,
      metadata_json: {
        candidate_name: candidate.candidate_name,
        candidate_id:   params.candidateId,
        from:           candidate.status,
        to:             updates.status,
      },
    })
  }

  if ('deleted_at' in updates) {
    await admin.from('project_activity').insert({
      project_id:    params.id,
      user_id:       user.id,
      action_type:   'candidate_status_changed' satisfies ProjectActivityType,
      metadata_json: { candidate_name: candidate.candidate_name, candidate_id: params.candidateId, removed: true },
    })
  }

  return NextResponse.json({ success: true })
}
