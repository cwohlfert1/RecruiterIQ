import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshClientIntel } from '@/lib/cqi/client-intel'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; candidateId: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  let body: {
    outcome?: string
    rejection_reason?: string
    is_catfish?: boolean
    catfish_notes?: string | null
    notes?: string | null
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { outcome, rejection_reason, is_catfish, catfish_notes, notes } = body
  if (!outcome || !['rejected', 'placed', 'withdrawn'].includes(outcome)) {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
  }

  // Fetch project + candidate
  const [{ data: project }, { data: candidate }] = await Promise.all([
    supabase.from('projects').select('id, title, client_name').eq('id', params.id).single(),
    supabase.from('project_candidates')
      .select('id, candidate_name, cqi_score, cqi_breakdown_json, pipeline_stage')
      .eq('id', params.candidateId)
      .eq('project_id', params.id)
      .is('deleted_at', null)
      .single(),
  ])

  if (!project || !candidate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Save outcome
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { error } = await db.from('placement_outcomes').insert({
    user_id: user.id,
    candidate_id: params.candidateId,
    project_id: params.id,
    client_company: project.client_name ?? '',
    job_title: project.title ?? '',
    cqi_score: candidate.cqi_score,
    cqi_breakdown: candidate.cqi_breakdown_json,
    pipeline_stage_reached: candidate.pipeline_stage,
    rejection_reason: rejection_reason || null,
    catfish_notes: catfish_notes || null,
    is_catfish: is_catfish === true,
    outcome,
    notes: notes || null,
  })

  if (error) {
    console.error('[outcome] insert error:', error)
    return NextResponse.json({ error: 'Failed to save outcome' }, { status: 500 })
  }

  // Refresh client intel cache (non-blocking)
  refreshClientIntel(db, user.id, project.client_name ?? '', project.title ?? '').catch(
    (err: unknown) => console.error('[outcome] intel refresh error:', err)
  )

  return NextResponse.json({ ok: true })
}
