import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { incrementAICallCount } from '@/lib/ai-gate'
import type { BreakdownJson, ProjectActivityType } from '@/types/database'

interface ClaudeBreakdownCategory { score: number; weight: number; weighted: number; explanation: string }
interface ClaudeScoreResponse {
  overall_score:  number
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
  { params }: { params: { id: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
  }

  const { data: project } = await supabase
    .from('projects').select('id, owner_id, jd_text').eq('id', params.id).single()

  if (!project?.jd_text) {
    return new Response(JSON.stringify({ error: 'Project has no job description' }), { status: 400 })
  }

  const { data: memberRow } = await supabase.from('project_members').select('role').eq('project_id', params.id).eq('user_id', user.id).single()
  const isOwner = project.owner_id === user.id
  const role    = memberRow?.role as string | undefined
  if (!isOwner && role !== 'owner' && role !== 'collaborator') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  const { data: unscored } = await supabase
    .from('project_candidates')
    .select('id, candidate_name, resume_text')
    .eq('project_id', params.id)
    .is('cqi_score', null)
    .is('deleted_at', null)

  if (!unscored || unscored.length === 0) {
    return new Response(JSON.stringify({ error: 'No unscored candidates' }), { status: 400 })
  }

  const total   = unscored.length
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

      let scored = 0
      let failed = 0

      await admin.from('project_activity').insert({
        project_id:    params.id,
        user_id:       user.id,
        action_type:   'batch_score_started' satisfies ProjectActivityType,
        metadata_json: { total, candidate_ids: unscored.map((c: { id: string }) => c.id) },
      })

      for (const candidate of unscored) {
        if (!validateWordCount(candidate.resume_text, 5000)) {
          failed++
          send({ type: 'error', candidateId: candidate.id, current: scored + failed, total, error: 'Resume too long' })
          continue
        }

        try {
          const response = await anthropic.messages.create({
            model:      MODEL,
            max_tokens: 1024,
            system:     'You are an expert technical recruiter. Return ONLY valid JSON.',
            messages:   [{
              role: 'user', content: `Score this resume against this job description using the CQI framework.

Categories: Technical Fit (40%), Domain Experience (15%), Scope & Impact (15%), Communication (15%), Catfish Risk (15% inverted).
Catfish Risk is inverted: score 0=no risk (full 15pts), score 100=high risk (0pts).
overall_score = (technical_fit*0.40) + (domain_experience*0.15) + (scope_impact*0.15) + (communication*0.15) + ((100-catfish_risk)*0.15)
recommendation: "Strong Submit" (>=85), "Submit" (70-84), "Borderline" (55-69), "Pass" (<55)

Job Description:
${project.jd_text}

Resume:
${candidate.resume_text}

Return ONLY JSON:
{
  "overall_score": <integer 0-100>,
  "recommendation": "<Strong Submit|Submit|Borderline|Pass>",
  "breakdown": {
    "technical_fit":     { "score": <0-100>, "weight": 0.40, "weighted": <rounded>, "explanation": "" },
    "domain_experience": { "score": <0-100>, "weight": 0.15, "weighted": <rounded>, "explanation": "" },
    "scope_impact":      { "score": <0-100>, "weight": 0.15, "weighted": <rounded>, "explanation": "" },
    "communication":     { "score": <0-100>, "weight": 0.15, "weighted": <rounded>, "explanation": "" },
    "catfish_risk":      { "score": <0-100>, "weight": 0.15, "weighted": <(100-score)*0.15 rounded>, "explanation": "" }
  }
}`,
            }],
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

          await supabase.from('project_candidates')
            .update({ cqi_score: data.overall_score, cqi_breakdown_json: breakdownWithRec })
            .eq('id', candidate.id)

          await incrementAICallCount(user.id)
          scored++

          send({
            type:         'progress',
            candidateId:  candidate.id,
            score:        data.overall_score,
            breakdown:    breakdownWithRec,
            current:      scored + failed,
            total,
          })
        } catch {
          failed++
          send({ type: 'error', candidateId: candidate.id, current: scored + failed, total, error: 'Scoring failed' })
        }
      }

      await admin.from('project_activity').insert({
        project_id:    params.id,
        user_id:       user.id,
        action_type:   'batch_score_completed' satisfies ProjectActivityType,
        metadata_json: { scored, failed, total },
      })

      send({ type: 'complete', scored, failed, total })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
