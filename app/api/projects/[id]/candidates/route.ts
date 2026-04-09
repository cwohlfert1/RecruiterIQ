import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { incrementAICallCount } from '@/lib/ai-gate'
import type { BreakdownJson, ProjectActivityType } from '@/types/database'
import { CQI_SYSTEM_PROMPT, buildCqiUserPrompt } from '@/lib/cqi/scoring-prompt'

// ─── Claude scoring ────────────────────────────────────────────

interface ClaudeBreakdownCategory {
  score:       number
  weight:      number
  weighted:    number
  explanation: string
}

interface ClaudeScoreResponse {
  overall_score:  number
  job_title:      string
  recommendation: 'Strong Submit' | 'Submit' | 'Borderline' | 'Pass'
  breakdown: {
    technical_fit:     ClaudeBreakdownCategory
    domain_experience: ClaudeBreakdownCategory
    scope_impact:      ClaudeBreakdownCategory
    communication:     ClaudeBreakdownCategory
    catfish_risk:      ClaudeBreakdownCategory
  }
}

async function scoreWithClaude(
  resumeText: string,
  jdText: string,
): Promise<{ score: number; breakdownJson: BreakdownJson } | null> {
  const userPrompt = buildCqiUserPrompt(jdText, resumeText)

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1024,
      system:     CQI_SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userPrompt }],
    })
    const raw     = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const data    = JSON.parse(cleaned) as ClaudeScoreResponse

    const breakdownJson: BreakdownJson = {
      technical_fit:     { score: data.breakdown.technical_fit.score,     weight: 0.40, weighted: Math.round(data.breakdown.technical_fit.score     * 0.40) },
      domain_experience: { score: data.breakdown.domain_experience.score, weight: 0.15, weighted: Math.round(data.breakdown.domain_experience.score * 0.15) },
      scope_impact:      { score: data.breakdown.scope_impact.score,      weight: 0.15, weighted: Math.round(data.breakdown.scope_impact.score      * 0.15) },
      communication:     { score: data.breakdown.communication.score,     weight: 0.15, weighted: Math.round(data.breakdown.communication.score     * 0.15) },
      catfish_risk:      { score: data.breakdown.catfish_risk.score,      weight: 0.15, weighted: Math.round((100 - data.breakdown.catfish_risk.score) * 0.15) },
    }
    const breakdownWithRec = { ...breakdownJson, recommendation: data.recommendation } as typeof breakdownJson & { recommendation: typeof data.recommendation }

    return { score: data.overall_score, breakdownJson: breakdownWithRec as BreakdownJson }
  } catch {
    return null
  }
}

// ─── POST /api/projects/[id]/candidates ────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Verify project access
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id, owner_id, jd_text, title, client_name')
    .eq('id', params.id)
    .single()

  if (projError || !project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify collaborator or owner
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

  // Parse body
  let body: { candidate_name?: unknown; candidate_email?: unknown; resume_text?: unknown; pipeline_stage?: unknown; override?: boolean; pay_rate_min?: unknown; pay_rate_max?: unknown; pay_rate_type?: unknown; linkedin_url?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { candidate_name, candidate_email, resume_text, pipeline_stage, override: overrideFlag, pay_rate_min, pay_rate_max, pay_rate_type, linkedin_url } = body

  if (typeof candidate_name !== 'string' || !candidate_name.trim()) {
    return NextResponse.json({ error: 'candidate_name is required' }, { status: 400 })
  }
  // Email is optional — validate format only if provided
  const safeEmail = typeof candidate_email === 'string' && candidate_email.trim()
    ? candidate_email.trim()
    : ''
  if (safeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }
  // Resume required only if project has a JD (needed for auto-scoring)
  if (typeof resume_text === 'string' && resume_text.trim() && !validateWordCount(resume_text, 5000)) {
    return NextResponse.json({ error: 'Resume exceeds 5000 words' }, { status: 400 })
  }
  if (project.jd_text && (typeof resume_text !== 'string' || !resume_text.trim())) {
    return NextResponse.json({ error: 'Resume is required when project has a JD' }, { status: 400 })
  }
  // Check email uniqueness within project (only if email provided)
  if (safeEmail) {
    const { data: existing } = await supabase
      .from('project_candidates')
      .select('id')
      .eq('project_id', params.id)
      .eq('candidate_email', safeEmail.toLowerCase())
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This candidate is already in this project.', existing_id: existing.id },
        { status: 409 },
      )
    }
  }

  // Check agency-wide DNU/Catfish flag (skip if no email or user explicitly overrides)
  if (!overrideFlag && safeEmail) {
    const adminCheck = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: flagRecord } = await adminCheck
      .from('flagged_candidates')
      .select('flag_type, reason, candidate_name')
      .eq('agency_owner_id', project.owner_id)
      .eq('candidate_email', safeEmail.toLowerCase())
      .single()

    if (flagRecord) {
      return NextResponse.json({ flag_warning: flagRecord }, { status: 200 })
    }
  }

  const VALID_STAGES = ['sourced','contacted','internal_submittal','assessment','submitted','placed','rejected']
  const insertStage  = (typeof pipeline_stage === 'string' && VALID_STAGES.includes(pipeline_stage))
    ? pipeline_stage
    : 'sourced'

  // Insert candidate (unscored initially)
  const { data: candidate, error: insertError } = await supabase
    .from('project_candidates')
    .insert({
      project_id:      params.id,
      candidate_name:  candidate_name.trim(),
      candidate_email: safeEmail ? safeEmail.toLowerCase() : '',
      resume_text:     typeof resume_text === 'string' ? resume_text.trim() : '',
      added_by:        user.id,
      status:          'reviewing',
      pipeline_stage:  insertStage,
      ...(typeof pay_rate_min === 'number' ? { pay_rate_min } : {}),
      ...(typeof pay_rate_max === 'number' ? { pay_rate_max } : {}),
      ...(typeof pay_rate_type === 'string' ? { pay_rate_type } : {}),
      ...(typeof linkedin_url === 'string' && linkedin_url.trim() ? { linkedin_url: linkedin_url.trim() } : {}),
    })
    .select()
    .single()

  if (insertError || !candidate) {
    return NextResponse.json({ error: 'Failed to add candidate' }, { status: 500 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Score if JD exists
  let scored = false
  let scoreValue: number | null = null

  const safeResume = typeof resume_text === 'string' ? resume_text.trim() : ''
  if (project.jd_text && safeResume && validateWordCount(project.jd_text, 2000)) {
    const result = await scoreWithClaude(safeResume, project.jd_text)

    if (result) {
      await supabase
        .from('project_candidates')
        .update({ cqi_score: result.score, cqi_breakdown_json: result.breakdownJson })
        .eq('id', candidate.id)

      candidate.cqi_score         = result.score
      candidate.cqi_breakdown_json = result.breakdownJson
      scored     = true
      scoreValue = result.score
      await incrementAICallCount(user.id)
    }
  }

  // Log activity
  await admin.from('project_activity').insert({
    project_id:    params.id,
    user_id:       user.id,
    action_type:   'candidate_added' satisfies ProjectActivityType,
    metadata_json: {
      candidate_name: candidate_name.trim(),
      candidate_id:   candidate.id,
      ...(scored && scoreValue !== null ? { cqi_score: scoreValue } : {}),
    },
  })

  return NextResponse.json({ candidate, scored }, { status: 201 })
}
