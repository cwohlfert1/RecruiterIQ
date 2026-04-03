import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { incrementAICallCount } from '@/lib/ai-gate'
import type { BreakdownJson, ProjectActivityType } from '@/types/database'

interface ClaudeBreakdownCategory {
  score: number; weight: number; weighted: number; explanation: string
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

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; candidateId: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Fetch project + candidate
  const [{ data: project }, { data: candidate }] = await Promise.all([
    supabase.from('projects').select('id, owner_id, jd_text').eq('id', params.id).single(),
    supabase.from('project_candidates')
      .select('id, project_id, resume_text, candidate_name')
      .eq('id', params.candidateId)
      .eq('project_id', params.id)
      .is('deleted_at', null)
      .single(),
  ])

  if (!project || !candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!project.jd_text) return NextResponse.json({ error: 'Project has no job description' }, { status: 400 })

  // Verify edit access
  const { data: memberRow } = await supabase.from('project_members').select('role').eq('project_id', params.id).eq('user_id', user.id).single()
  const isOwner = project.owner_id === user.id
  const role    = memberRow?.role as string | undefined
  if (!isOwner && role !== 'owner' && role !== 'collaborator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!validateWordCount(candidate.resume_text, 5000)) {
    return NextResponse.json({ error: 'Resume too long' }, { status: 400 })
  }

  const userPrompt = `Score this resume against this job description using the CQI (Candidate Quality Index) framework.

Scoring categories and weights:
- Technical Fit (40%): exact match to required tools/stack and depth of hands-on experience
- Domain Experience (15%): relevance of industry background and environment
- Scope & Impact (15%): ownership, complexity, and measurable contributions
- Communication (15%): clarity, articulation, and stakeholder interaction signals from the resume
- Catfish Risk (15%): inconsistencies, vague experience, or overinflated skills — score 0-100 where 100 = very high risk

IMPORTANT for Catfish Risk: this score is INVERTED when computing overall_score.
overall_score = (technical_fit*0.40) + (domain_experience*0.15) + (scope_impact*0.15) + (communication*0.15) + ((100-catfish_risk)*0.15)

recommendation: "Strong Submit" (>=85), "Submit" (70-84), "Borderline" (55-69), "Pass" (<55)

Job Description:
${project.jd_text}

Resume:
${candidate.resume_text}

Return ONLY JSON:
{
  "overall_score": <integer 0-100>,
  "job_title": "",
  "recommendation": "<Strong Submit|Submit|Borderline|Pass>",
  "breakdown": {
    "technical_fit":     { "score": <0-100>, "weight": 0.40, "weighted": <score*0.40 rounded>, "explanation": "<sentence>" },
    "domain_experience": { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<sentence>" },
    "scope_impact":      { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<sentence>" },
    "communication":     { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<sentence>" },
    "catfish_risk":      { "score": <0-100>, "weight": 0.15, "weighted": <(100-score)*0.15 rounded>, "explanation": "<sentence>" }
  }
}`

  let claudeData: ClaudeScoreResponse
  try {
    const response = await anthropic.messages.create({
      model: MODEL, max_tokens: 1024,
      system: 'You are an expert technical recruiter. Return ONLY valid JSON.',
      messages: [{ role: 'user', content: userPrompt }],
    })
    const raw     = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    claudeData = JSON.parse(cleaned) as ClaudeScoreResponse
  } catch {
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }

  const breakdownJson: BreakdownJson = {
    technical_fit:     { score: claudeData.breakdown.technical_fit.score,     weight: 0.40, weighted: Math.round(claudeData.breakdown.technical_fit.score     * 0.40) },
    domain_experience: { score: claudeData.breakdown.domain_experience.score, weight: 0.15, weighted: Math.round(claudeData.breakdown.domain_experience.score * 0.15) },
    scope_impact:      { score: claudeData.breakdown.scope_impact.score,      weight: 0.15, weighted: Math.round(claudeData.breakdown.scope_impact.score      * 0.15) },
    communication:     { score: claudeData.breakdown.communication.score,     weight: 0.15, weighted: Math.round(claudeData.breakdown.communication.score     * 0.15) },
    catfish_risk:      { score: claudeData.breakdown.catfish_risk.score,      weight: 0.15, weighted: Math.round((100 - claudeData.breakdown.catfish_risk.score) * 0.15) },
  }
  const breakdownWithRec = { ...breakdownJson, recommendation: claudeData.recommendation } as typeof breakdownJson & { recommendation: typeof claudeData.recommendation }

  await supabase.from('project_candidates')
    .update({ cqi_score: claudeData.overall_score, cqi_breakdown_json: breakdownWithRec })
    .eq('id', params.candidateId)

  await incrementAICallCount(user.id)

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await admin.from('project_activity').insert({
    project_id:    params.id,
    user_id:       user.id,
    action_type:   'candidate_scored' satisfies ProjectActivityType,
    metadata_json: { candidate_name: candidate.candidate_name, candidate_id: params.candidateId, cqi_score: claudeData.overall_score },
  })

  return NextResponse.json({ cqi_score: claudeData.overall_score, cqi_breakdown_json: breakdownWithRec })
}
