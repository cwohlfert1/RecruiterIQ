import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { incrementAICallCount } from '@/lib/ai-gate'
import type { BreakdownJson, ProjectActivityType } from '@/types/database'

interface ClaudeBreakdownCategory { score: number; weight: number; weighted: number; explanation: string }
interface ClaudeScoreResponse {
  overall_score: number
  breakdown: {
    must_have_skills:  ClaudeBreakdownCategory
    domain_experience: ClaudeBreakdownCategory
    communication:     ClaudeBreakdownCategory
    tenure_stability:  ClaudeBreakdownCategory
    tool_depth:        ClaudeBreakdownCategory
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
              role: 'user', content: `Score this resume against this job description.

Job Description:
${project.jd_text}

Resume:
${candidate.resume_text}

Return ONLY JSON:
{
  "overall_score": <integer 0-100>,
  "breakdown": {
    "must_have_skills":  { "score": <0-100>, "weight": 0.55, "weighted": <rounded>, "explanation": "" },
    "domain_experience": { "score": <0-100>, "weight": 0.10, "weighted": <rounded>, "explanation": "" },
    "communication":     { "score": <0-100>, "weight": 0.15, "weighted": <rounded>, "explanation": "" },
    "tenure_stability":  { "score": <0-100>, "weight": 0.10, "weighted": <rounded>, "explanation": "" },
    "tool_depth":        { "score": <0-100>, "weight": 0.10, "weighted": <rounded>, "explanation": "" }
  }
}`,
            }],
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

          await supabase.from('project_candidates')
            .update({ cqi_score: data.overall_score, cqi_breakdown_json: breakdownJson })
            .eq('id', candidate.id)

          await incrementAICallCount(user.id)
          scored++

          send({
            type:         'progress',
            candidateId:  candidate.id,
            score:        data.overall_score,
            breakdown:    breakdownJson,
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
