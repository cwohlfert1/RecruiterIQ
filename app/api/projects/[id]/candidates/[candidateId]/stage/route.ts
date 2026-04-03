import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PipelineStage } from '@/types/database'

const VALID_STAGES: PipelineStage[] = [
  'sourced', 'contacted', 'internal_submittal',
  'assessment', 'submitted', 'placed', 'rejected',
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; candidateId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { stage } = body as { stage: PipelineStage }

  if (!VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  }

  // Verify project access + collaborator+ role
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, project_members(user_id, role)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find((m: { user_id: string; role: string }) => m.user_id === user.id)
  const isOwner      = project.owner_id === user.id
  const callerRole   = callerMember?.role ?? (isOwner ? 'owner' : null)

  if (!callerRole || callerRole === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch candidate (verify it belongs to this project)
  const { data: candidate, error: candError } = await supabase
    .from('project_candidates')
    .select('id, candidate_name, pipeline_stage')
    .eq('id', params.candidateId)
    .eq('project_id', params.id)
    .is('deleted_at', null)
    .single()

  if (candError || !candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  if (candidate.pipeline_stage === stage) {
    return NextResponse.json({ stage })
  }

  // Update pipeline stage + reset stage_changed_at
  const { error: updateError } = await supabase
    .from('project_candidates')
    .update({ pipeline_stage: stage, stage_changed_at: new Date().toISOString() })
    .eq('id', params.candidateId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Log activity
  await supabase.from('project_activity').insert({
    project_id:    params.id,
    user_id:       user.id,
    action_type:   'candidate_stage_changed',
    metadata_json: {
      name:       candidate.candidate_name,
      from_stage: candidate.pipeline_stage,
      to_stage:   stage,
    },
  })

  return NextResponse.json({ stage })
}
