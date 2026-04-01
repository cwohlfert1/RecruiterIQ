import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { checkAIGate, incrementAICallCount } from '@/lib/ai-gate'
import { createClient } from '@/lib/supabase/server'

interface RedFlag {
  type:        string
  severity:    'high' | 'medium' | 'low'
  evidence:    string
  explanation: string
}

interface ClaudeResponse {
  integrity_score: number
  flags:           RedFlag[]
  summary:         string
  recommendation:  'proceed' | 'caution' | 'pass'
}

function buildPrompt(resumeText: string, jdText?: string): string {
  const jdSection = jdText?.trim()
    ? `\nJOB DESCRIPTION (use to detect skill mismatches):\n${jdText}\n`
    : ''

  return `You are an expert technical recruiter conducting a thorough resume red flag analysis.

Analyze this resume and identify any red flags. Be specific — quote actual text or dates from the resume as evidence.
${jdSection}
RESUME:
${resumeText}

FLAGS TO DETECT (check each one):
1. Employment gaps — flag any gap > 3 months between jobs. Calculate the actual dates.
2. Job hopping — 3+ jobs in under 3 years
3. Vague skill claims — "familiar with", "exposure to", "knowledge of", "worked with", "some experience" used without evidence of actual project work
4. Title vs responsibility mismatch — senior title with clearly junior duties described
5. Date overlaps — two jobs listed as concurrent (same or overlapping date ranges)
6. Keyword stuffing — skills listed in a Skills section but never mentioned in actual experience descriptions
7. Education red flags — unexplained gaps in education, credential inconsistencies
8. Catfish signals — (only if JD provided) skills prominently claimed but contradicted by years or depth of experience
9. Suspiciously perfect structure — every job description uses identical buzzword templates with no real specifics

Assign severity:
- high: directly contradicts claims, serious integrity concern
- medium: warrants follow-up question, possible explanation exists
- low: minor concern, easy to address

Calculate integrity_score 0-100:
- Start at 100
- Deduct per flag: high = 15-25 pts, medium = 8-12 pts, low = 3-5 pts
- Minimum 0

For recommendation:
- "proceed" = integrity_score >= 75, no high-severity flags
- "caution" = integrity_score 50-74, or 1+ high-severity flags worth discussing
- "pass" = integrity_score < 50, or 2+ high-severity flags showing pattern of dishonesty

Return ONLY valid JSON — no markdown, no explanation outside the JSON:
{
  "integrity_score": <0-100>,
  "flags": [
    {
      "type": "<flag category name>",
      "severity": "high" | "medium" | "low",
      "evidence": "<specific quote or dates from the resume>",
      "explanation": "<one sentence: why this matters to a recruiter>"
    }
  ],
  "summary": "<2 sentences: overall assessment and most important flag>",
  "recommendation": "proceed" | "caution" | "pass"
}

If no flags are found, return an empty flags array and integrity_score of 95.`
}

export async function POST(req: NextRequest) {
  // 1. Auth + plan gate
  const gate = await checkAIGate()
  if (!gate.allowed) {
    const status = gate.reason === 'unauthenticated' ? 401 : 403
    return NextResponse.json({ error: gate.reason }, { status })
  }

  // 2. Parse inputs
  let body: { resume_text?: unknown; jd_text?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { resume_text, jd_text } = body

  if (typeof resume_text !== 'string' || !resume_text.trim()) {
    return NextResponse.json({ error: 'resume_text is required' }, { status: 400 })
  }
  if (!validateWordCount(resume_text, 5000)) {
    return NextResponse.json({ error: 'Resume exceeds 5000 words' }, { status: 400 })
  }
  if (jd_text !== undefined && typeof jd_text !== 'string') {
    return NextResponse.json({ error: 'jd_text must be a string' }, { status: 400 })
  }
  if (typeof jd_text === 'string' && !validateWordCount(jd_text, 2000)) {
    return NextResponse.json({ error: 'Job description exceeds 2000 words' }, { status: 400 })
  }

  // 3. Call Claude
  let claudeData: ClaudeResponse
  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 2048,
      system:     'You are an expert technical recruiter. Return ONLY valid JSON, no markdown.',
      messages:   [{ role: 'user', content: buildPrompt(resume_text, typeof jd_text === 'string' ? jd_text : undefined) }],
    })
    const raw     = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    claudeData = JSON.parse(cleaned) as ClaudeResponse
  } catch {
    return NextResponse.json({ error: 'Failed to get or parse Claude response' }, { status: 500 })
  }

  const { integrity_score, flags, summary, recommendation } = claudeData

  // 4. Save to Supabase
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: row, error: insertError } = await db
    .from('red_flag_checks')
    .insert({
      user_id:         gate.userId,
      resume_text,
      jd_text:         typeof jd_text === 'string' && jd_text.trim() ? jd_text : null,
      integrity_score: Math.max(0, Math.min(100, Math.round(integrity_score))),
      flags_json:      flags ?? [],
      summary,
      recommendation,
    })
    .select('id')
    .single()

  if (insertError || !row) {
    return NextResponse.json({ error: 'Failed to save result' }, { status: 500 })
  }

  // 5. Log activity
  await db.from('activity_log').insert({
    user_id:     gate.userId,
    feature:     'resume_scorer',
    record_id:   row.id,
    description: `Red flag check — integrity score ${integrity_score}/100, ${(flags ?? []).length} flag(s) found`,
  })

  // 6. Increment AI call count
  await incrementAICallCount(gate.userId)

  return NextResponse.json({ integrity_score, flags: flags ?? [], summary, recommendation, record_id: row.id })
}
