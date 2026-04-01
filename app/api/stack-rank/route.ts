import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { checkAIGate, incrementAICallCount } from '@/lib/ai-gate'
import { createClient } from '@/lib/supabase/server'

// ─── Request / Claude response types ──────────────────────────────────────────

interface CandidateInput {
  name:       string
  resumeText: string
}

interface RequestBody {
  jobTitle:        string
  jobDescription:  string
  candidates:      CandidateInput[]
}

interface ClaudeCandidate {
  name:      string
  cqi_score: number
  rank:      number
  strengths: string[]
  gaps:      string[]
}

// breakdown_json shape stored in DB — reuses the BreakdownJson slot with an
// extended structure that holds CQI data for the stack-ranking feature.
interface RankingBreakdownJson {
  cqi_score: number
  strengths: string[]
  gaps:      string[]
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth + agency plan gate
  const gate = await checkAIGate('agency')
  if (!gate.allowed) {
    const status = gate.reason === 'unauthenticated' ? 401 : 403
    return NextResponse.json(
      { error: gate.reason, reason: gate.reason, planTier: gate.planTier },
      { status },
    )
  }

  // 2. Parse body
  let body: Partial<RequestBody>
  try {
    body = (await req.json()) as Partial<RequestBody>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { jobTitle, jobDescription, candidates } = body

  // 3. Validate inputs
  if (typeof jobTitle !== 'string' || !jobTitle.trim()) {
    return NextResponse.json({ error: 'jobTitle is required' }, { status: 400 })
  }
  if (jobTitle.trim().length > 100) {
    return NextResponse.json({ error: 'jobTitle must be 100 characters or fewer' }, { status: 400 })
  }
  if (typeof jobDescription !== 'string' || !jobDescription.trim()) {
    return NextResponse.json({ error: 'jobDescription is required' }, { status: 400 })
  }
  if (!validateWordCount(jobDescription, 500)) {
    return NextResponse.json({ error: 'jobDescription exceeds 500 words' }, { status: 400 })
  }
  if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 10) {
    return NextResponse.json({ error: 'candidates must be an array of 2–10 items' }, { status: 400 })
  }
  for (const c of candidates) {
    if (typeof c.name !== 'string' || !c.name.trim()) {
      return NextResponse.json({ error: 'Each candidate must have a name' }, { status: 400 })
    }
    if (c.name.trim().length > 100) {
      return NextResponse.json({ error: `Candidate name "${c.name}" exceeds 100 characters` }, { status: 400 })
    }
    if (typeof c.resumeText !== 'string' || !c.resumeText.trim()) {
      return NextResponse.json({ error: `Candidate "${c.name}" must have resumeText` }, { status: 400 })
    }
    if (!validateWordCount(c.resumeText, 500)) {
      return NextResponse.json({ error: `Candidate "${c.name}" resumeText exceeds 500 words` }, { status: 400 })
    }
  }

  // 4. Build Claude prompt
  const userPrompt = `You are an expert recruiter evaluating candidates for a role. Score each candidate 0-100 (CQI - Candidate Quality Index) based on fit to the job description.

Job Title: ${jobTitle.trim()}
Job Description: ${jobDescription.trim()}

Candidates:
${candidates.map((c, i) => `${i + 1}. ${c.name}\n${c.resumeText}`).join('\n\n---\n\n')}

Return ONLY a valid JSON array (no markdown, no explanation) in this exact format:
[
  {
    "name": "Candidate Name",
    "cqi_score": 85,
    "rank": 1,
    "strengths": ["Strong TypeScript", "5 years relevant experience"],
    "gaps": ["No management experience"]
  }
]

Sort by cqi_score descending. rank starts at 1.`

  // 5. Call Claude
  let rankedCandidates: ClaudeCandidate[]
  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 2000,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    rankedCandidates = JSON.parse(cleaned) as ClaudeCandidate[]

    if (!Array.isArray(rankedCandidates)) {
      throw new Error('Claude did not return an array')
    }
  } catch {
    return NextResponse.json({ error: 'Failed to get or parse Claude response' }, { status: 500 })
  }

  // 6. Save to Supabase
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: ranking, error: rankingError } = await db
    .from('stack_rankings')
    .insert({
      user_id:   gate.userId,
      job_title: jobTitle.trim(),
      jd_text:   jobDescription.trim(),
    })
    .select('id')
    .single()

  if (rankingError || !ranking) {
    return NextResponse.json({ error: 'Failed to save ranking session' }, { status: 500 })
  }

  const candidateRows = rankedCandidates.map((c) => {
    const originalCandidate = candidates.find((orig) => orig.name === c.name)
    const breakdown: RankingBreakdownJson = {
      cqi_score: c.cqi_score,
      strengths: c.strengths,
      gaps:      c.gaps,
    }
    return {
      ranking_id:     ranking.id,
      user_id:        gate.userId,
      candidate_name: c.name,
      resume_text:    originalCandidate?.resumeText ?? '',
      score:          c.cqi_score,
      rank:           c.rank,
      // breakdown_json expects BreakdownJson shape — store CQI data here
      breakdown_json: breakdown as unknown as import('@/types/database').BreakdownJson,
      notes:          null,
    }
  })

  const { data: insertedCandidates, error: candidatesError } = await db
    .from('stack_ranking_candidates')
    .insert(candidateRows)
    .select('id, rank, candidate_name')

  if (candidatesError) {
    return NextResponse.json({ error: 'Failed to save candidate results' }, { status: 500 })
  }

  // 7. Log activity
  await db.from('activity_log').insert({
    user_id:     gate.userId,
    feature:     'stack_ranking',
    record_id:   ranking.id,
    description: `Ranked ${rankedCandidates.length} candidates for "${jobTitle.trim()}"`,
  })

  // 8. Increment AI call count (counts as 1 call regardless of candidate count)
  await incrementAICallCount(gate.userId)

  // 9. Return ranked results — include DB ids for note-saving
  const idMap = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (insertedCandidates ?? []).map((row: any) => [row.candidate_name, row.id])
  )

  return NextResponse.json({
    rankingId: ranking.id,
    jobTitle:  jobTitle.trim(),
    candidates: rankedCandidates.map((c) => ({
      id:        idMap.get(c.name) ?? null,
      name:      c.name,
      cqi_score: c.cqi_score,
      rank:      c.rank,
      strengths: c.strengths,
      gaps:      c.gaps,
      notes:     null,
    })),
  })
}
