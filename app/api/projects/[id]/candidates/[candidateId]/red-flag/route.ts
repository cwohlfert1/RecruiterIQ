import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { incrementAICallCount } from '@/lib/ai-gate'
import type { RedFlag, ProjectActivityType } from '@/types/database'

interface ClaudeRedFlagResponse {
  integrity_score: number
  flags:           RedFlag[]
  summary:         string
  recommendation:  'proceed' | 'caution' | 'pass'
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; candidateId: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

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

  const { data: memberRow } = await supabase.from('project_members').select('role').eq('project_id', params.id).eq('user_id', user.id).single()
  const isOwner = project.owner_id === user.id
  const role    = memberRow?.role as string | undefined
  if (!isOwner && role !== 'owner' && role !== 'collaborator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!validateWordCount(candidate.resume_text, 5000)) {
    return NextResponse.json({ error: 'Resume too long' }, { status: 400 })
  }

  const jdSection = project.jd_text?.trim()
    ? `\nJOB DESCRIPTION:\n${project.jd_text}\n`
    : ''

  const prompt = `You are an expert technical recruiter. Analyze this resume for red flags.
${jdSection}
RESUME:
${candidate.resume_text}

Identify: employment gaps >3mo, job hopping, vague skill claims, title/responsibility mismatch, date overlaps, keyword stuffing, education gaps${project.jd_text ? ', skill mismatches vs JD' : ''}.

Severity: high (serious integrity concern), medium (warrants discussion), low (minor).
integrity_score: start 100, deduct high=15-25, medium=8-12, low=3-5.
recommendation: "proceed" (>=75, no high), "caution" (50-74 or 1+ high), "pass" (<50 or 2+ high).

Return ONLY JSON:
{
  "integrity_score": <0-100>,
  "flags": [{ "type": "<name>", "severity": "high"|"medium"|"low", "evidence": "<quote>", "explanation": "<sentence>" }],
  "summary": "<2 sentences>",
  "recommendation": "proceed"|"caution"|"pass"
}`

  let claudeData: ClaudeRedFlagResponse
  try {
    const response = await anthropic.messages.create({
      model: MODEL, max_tokens: 2048,
      system: 'You are an expert technical recruiter. Return ONLY valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    })
    const raw     = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    claudeData = JSON.parse(cleaned) as ClaudeRedFlagResponse
  } catch {
    return NextResponse.json({ error: 'Red flag check failed' }, { status: 500 })
  }

  const { integrity_score, flags, summary, recommendation } = claudeData
  const clampedScore = Math.max(0, Math.min(100, Math.round(integrity_score)))

  await supabase.from('project_candidates').update({
    red_flag_score:   clampedScore,
    red_flag_summary: summary,
    red_flags_json:   flags ?? [],
  }).eq('id', params.candidateId)

  await incrementAICallCount(user.id)

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await admin.from('project_activity').insert({
    project_id:    params.id,
    user_id:       user.id,
    action_type:   'red_flag_checked' satisfies ProjectActivityType,
    metadata_json: {
      candidate_name:  candidate.candidate_name,
      candidate_id:    params.candidateId,
      integrity_score: clampedScore,
      flag_count:      (flags ?? []).length,
    },
  })

  return NextResponse.json({ integrity_score: clampedScore, flags: flags ?? [], summary, recommendation })
}
