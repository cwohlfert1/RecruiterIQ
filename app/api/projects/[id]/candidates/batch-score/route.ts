import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { incrementAICallCount } from '@/lib/ai-gate'
import type { BreakdownJson, ProjectActivityType } from '@/types/database'
import { CQI_SYSTEM_PROMPT, buildCqiUserPrompt } from '@/lib/cqi/scoring-prompt'

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
            system:     CQI_SYSTEM_PROMPT,
            messages:   [{
              role: 'user', content: buildCqiUserPrompt(project.jd_text, candidate.resume_text),
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
