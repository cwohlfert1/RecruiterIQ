import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PipelineStage } from '@/types/database'

const VALID_STAGES: PipelineStage[] = [
  'reviewing', 'screened', 'internal_submittal',
  'client_submittal', 'interviewing', 'placed', 'rejected',
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; candidateId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await req.json().catch((err) => { console.error('[stage] JSON parse error:', err); return {} })
  const { stage } = body as { stage: PipelineStage }

  if (!VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  }

  // Verify project access + collaborator+ role
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title, client_name, project_members(user_id, role)')
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

  // Auto-create Spread Tracker entry when moved to Placed
  let spreadCreated = false
  if (stage === 'placed') {
    try {
      await supabase.from('spread_placements').insert({
        user_id:           user.id,
        consultant_name:   candidate.candidate_name,
        client_company:    project.client_name ?? '',
        client_color:      '#6366F1',
        role:              project.title ?? '',
        weekly_spread:     0,
        contract_end_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0], // 90 days default
        status:            'locked_up',
      })
      spreadCreated = true
    } catch (err) {
      console.error('[stage] spread auto-create failed:', err)
    }
  }

  return NextResponse.json({ stage, spreadCreated })
}
