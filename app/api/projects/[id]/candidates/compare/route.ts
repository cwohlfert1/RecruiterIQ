import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'

interface CompareResult {
  recommendation: 'A' | 'B' | 'tie'
  summary:        string
  candidateA: { strengths: string[]; weaknesses: string[] }
  candidateB: { strengths: string[]; weaknesses: string[] }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { candidateAId?: unknown; candidateBId?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { candidateAId, candidateBId } = body
  if (typeof candidateAId !== 'string' || typeof candidateBId !== 'string') {
    return NextResponse.json({ error: 'candidateAId and candidateBId required' }, { status: 400 })
  }
  if (candidateAId === candidateBId) {
    return NextResponse.json({ error: 'Cannot compare a candidate with itself' }, { status: 400 })
  }

  // Verify project membership
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, jd_text')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: memberRow } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', params.id)
    .eq('user_id', user.id)
    .single()

  const isOwner = project.owner_id === user.id
  const role    = memberRow?.role as string | undefined
  if (!isOwner && role !== 'owner' && role !== 'collaborator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch both candidates
  const [{ data: candA }, { data: candB }] = await Promise.all([
    supabase.from('project_candidates')
      .select('id, candidate_name, resume_text, cqi_score')
      .eq('id', candidateAId).eq('project_id', params.id).is('deleted_at', null).single(),
    supabase.from('project_candidates')
      .select('id, candidate_name, resume_text, cqi_score')
      .eq('id', candidateBId).eq('project_id', params.id).is('deleted_at', null).single(),
  ])

  if (!candA || !candB) return NextResponse.json({ error: 'One or both candidates not found' }, { status: 404 })

  const jdSection = project.jd_text
    ? `Job Description:\n${project.jd_text.slice(0, 1500)}\n\n`
    : ''

  const prompt = `${jdSection}Compare these two candidates and return ONLY valid JSON.

Candidate A — ${candA.candidate_name}:
${candA.resume_text.slice(0, 2000)}

Candidate B — ${candB.candidate_name}:
${candB.resume_text.slice(0, 2000)}

Return ONLY this JSON:
{
  "recommendation": "A" | "B" | "tie",
  "summary": "<1-2 sentence explanation of the recommendation>",
  "candidateA": {
    "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"]
  },
  "candidateB": {
    "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"]
  }
}`

  let result: CompareResult
  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1024,
      system:     'You are an expert technical recruiter. Return ONLY valid JSON, no markdown.',
      messages:   [{ role: 'user', content: prompt }],
    })
    const raw     = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    result = JSON.parse(cleaned) as CompareResult
  } catch {
    return NextResponse.json({ error: 'Comparison failed' }, { status: 500 })
  }

  return NextResponse.json({
    recommendation: result.recommendation,
    summary:        result.summary,
    candidateA: { name: candA.candidate_name, cqi_score: candA.cqi_score, ...result.candidateA },
    candidateB: { name: candB.candidate_name, cqi_score: candB.cqi_score, ...result.candidateB },
  })
}
