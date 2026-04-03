import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { incrementAICallCount } from '@/lib/ai-gate'
import type { BreakdownJson, ProjectActivityType } from '@/types/database'

// ─── Claude scoring ────────────────────────────────────────────

interface ClaudeBreakdownCategory {
  score:       number
  weight:      number
  weighted:    number
  explanation: string
}

interface ClaudeScoreResponse {
  overall_score: number
  job_title:     string
  breakdown: {
    must_have_skills:  ClaudeBreakdownCategory
    domain_experience: ClaudeBreakdownCategory
    communication:     ClaudeBreakdownCategory
    tenure_stability:  ClaudeBreakdownCategory
    tool_depth:        ClaudeBreakdownCategory
  }
}

async function scoreWithClaude(
  resumeText: string,
  jdText: string,
): Promise<{ score: number; breakdownJson: BreakdownJson } | null> {
  const userPrompt = `Score this resume against this job description using these exact weights:
- Must-Have Skills Match: 55%
- Domain/Industry Experience: 10%
- Communication & Clarity: 15%
- Tenure Stability: 10%
- Depth of Tool Usage: 10%

Job Description:
${jdText}

Resume:
${resumeText}

Return ONLY this JSON:
{
  "overall_score": <integer 0-100>,
  "job_title": "<extracted job title or empty string>",
  "breakdown": {
    "must_have_skills":  { "score": <0-100>, "weight": 0.55, "weighted": <rounded>, "explanation": "<sentence>" },
    "domain_experience": { "score": <0-100>, "weight": 0.10, "weighted": <rounded>, "explanation": "<sentence>" },
    "communication":     { "score": <0-100>, "weight": 0.15, "weighted": <rounded>, "explanation": "<sentence>" },
    "tenure_stability":  { "score": <0-100>, "weight": 0.10, "weighted": <rounded>, "explanation": "<sentence>" },
    "tool_depth":        { "score": <0-100>, "weight": 0.10, "weighted": <rounded>, "explanation": "<sentence>" }
  }
}`

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1024,
      system:     'You are an expert technical recruiter. Return ONLY valid JSON, no markdown.',
      messages:   [{ role: 'user', content: userPrompt }],
    })
    const raw     = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const data    = JSON.parse(cleaned) as ClaudeScoreResponse

    const breakdownJson: BreakdownJson = {
      must_have_skills:  { score: data.breakdown.must_have_skills.score,  weight: 0.55, weighted: Math.round(data.breakdown.must_have_skills.score  * 0.55) },
      domain_experience: { score: data.breakdown.domain_experience.score, weight: 0.10, weighted: Math.round(data.breakdown.domain_experience.score * 0.10) },
      communication:     { score: data.breakdown.communication.score,     weight: 0.15, weighted: Math.round(data.breakdown.communication.score     * 0.15) },
      tenure_stability:  { score: data.breakdown.tenure_stability.score,  weight: 0.10, weighted: Math.round(data.breakdown.tenure_stability.score  * 0.10) },
      tool_depth:        { score: data.breakdown.tool_depth.score,        weight: 0.10, weighted: Math.round(data.breakdown.tool_depth.score        * 0.10) },
    }

    return { score: data.overall_score, breakdownJson }
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
  let body: { candidate_name?: unknown; candidate_email?: unknown; resume_text?: unknown; pipeline_stage?: unknown; override?: boolean; pay_rate_min?: unknown; pay_rate_max?: unknown; pay_rate_type?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { candidate_name, candidate_email, resume_text, pipeline_stage, override: overrideFlag, pay_rate_min, pay_rate_max, pay_rate_type } = body

  if (typeof candidate_name !== 'string' || !candidate_name.trim()) {
    return NextResponse.json({ error: 'candidate_name is required' }, { status: 400 })
  }
  if (typeof candidate_email !== 'string' || !candidate_email.trim()) {
    return NextResponse.json({ error: 'candidate_email is required' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate_email.trim())) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }
  if (typeof resume_text !== 'string' || !resume_text.trim()) {
    return NextResponse.json({ error: 'resume_text is required' }, { status: 400 })
  }
  if (!validateWordCount(resume_text, 5000)) {
    return NextResponse.json({ error: 'Resume exceeds 5000 words' }, { status: 400 })
  }

  // Check email uniqueness within project
  const { data: existing } = await supabase
    .from('project_candidates')
    .select('id')
    .eq('project_id', params.id)
    .eq('candidate_email', candidate_email.trim().toLowerCase())
    .is('deleted_at', null)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'This candidate is already in this project.', existing_id: existing.id },
      { status: 409 },
    )
  }

  // Check agency-wide DNU/Catfish flag (skip if user explicitly overrides)
  if (!overrideFlag) {
    const adminCheck = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: flagRecord } = await adminCheck
      .from('flagged_candidates')
      .select('flag_type, reason, candidate_name')
      .eq('agency_owner_id', project.owner_id)
      .eq('candidate_email', candidate_email.trim().toLowerCase())
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
      candidate_email: candidate_email.trim().toLowerCase(),
      resume_text:     resume_text.trim(),
      added_by:        user.id,
      status:          'reviewing',
      pipeline_stage:  insertStage,
      ...(typeof pay_rate_min === 'number' ? { pay_rate_min } : {}),
      ...(typeof pay_rate_max === 'number' ? { pay_rate_max } : {}),
      ...(typeof pay_rate_type === 'string' ? { pay_rate_type } : {}),
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

  if (project.jd_text && validateWordCount(project.jd_text, 2000)) {
    const result = await scoreWithClaude(resume_text.trim(), project.jd_text)

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
