import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { checkAIGate } from '@/lib/ai-gate'

type FeedbackBucket = '< 100' | '100-500' | '500-2000' | '2000+'

function getRefinementInstruction(feedback: FeedbackBucket, variantType: string): string {
  const isTargeted = variantType === 'targeted'

  if (feedback === '< 100') {
    return `The current search returned too few results (< 100). LOOSEN it:
- Add 2–3 OR title synonyms / alternative job titles
- Make 1–2 required skills optional (move from AND to OR group)
- Broaden seniority expressions (e.g., add "mid-level" OR "senior" OR "lead")
- Remove overly specific exclusions`
  }

  if (feedback === '100-500') {
    if (isTargeted) {
      return `The search returned 100–500 results. This is PERFECT for a targeted search. No changes needed — confirm as optimal.`
    }
    return `The search returned 100–500 results. This is a bit narrow for a broad search. LOOSEN slightly:
- Add more title OR synonyms
- Make 1 required skill optional`
  }

  if (feedback === '500-2000') {
    if (!isTargeted) {
      return `The search returned 500–2000 results. This is PERFECT for a broad search. No changes needed — confirm as optimal.`
    }
    return `The search returned 500–2000 results. This is too broad for a targeted search. TIGHTEN:
- Add NOT exclusions (junior, intern, entry-level)
- Remove OR groups, use AND for more skills
- Specify seniority more precisely (e.g., "Senior" AND "5+ years")`
  }

  // 2000+
  return `The search returned 2000+ results — too broad. SIGNIFICANTLY TIGHTEN:
- Add specific location constraint
- Add more AND requirements
- Add NOT exclusions (junior, intern, contractor, freelance)
- Specify exact seniority and years of experience
- Remove broad OR groups`
}

function isGoodFeedback(feedback: FeedbackBucket, variantType: string): boolean {
  if (variantType === 'targeted' && feedback === '100-500') return true
  if (variantType === 'broad'    && feedback === '500-2000') return true
  return false
}

export async function POST(req: NextRequest) {
  const gate = await checkAIGate()
  if (!gate.allowed) {
    const status = gate.reason === 'unauthenticated' ? 401 : 403
    return NextResponse.json({ error: 'Access denied', reason: gate.reason }, { status })
  }

  let body: {
    variant_type:     string
    feedback:         FeedbackBucket
    current_linkedin: string
    current_indeed:   string
    job_title?:       string
    jd_text?:         string
    refinement_count?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { variant_type, feedback, current_linkedin, current_indeed, job_title, jd_text, refinement_count } = body

  const currentCount = refinement_count ?? 0
  if (currentCount >= 3) {
    return NextResponse.json({
      limited: true,
      message: 'Maximum refinements reached. Generate a new search to start fresh.',
    })
  }

  if (isGoodFeedback(feedback, variant_type)) {
    return NextResponse.json({
      confirmed: true,
      explanation: variant_type === 'targeted'
        ? 'Your targeted search is performing well — 100–500 results is the sweet spot.'
        : 'Your broad search is performing well — 500–2000 results is the sweet spot.',
      linkedin_string: current_linkedin,
      indeed_string:   current_indeed,
    })
  }

  const refinementInstruction = getRefinementInstruction(feedback, variant_type)

  const contextLine = job_title
    ? `Job Title: ${job_title}`
    : ''
  const jdLine = jd_text
    ? `\nJob Description excerpt:\n${jd_text.slice(0, 2000)}`
    : ''

  const prompt = `You are a Boolean search string expert. Refine this search string based on performance feedback.

${contextLine}${jdLine}

Current LinkedIn string:
${current_linkedin}

Current Indeed string:
${current_indeed}

Performance feedback: ${feedback} results
Variant type: ${variant_type}

Refinement instruction:
${refinementInstruction}

Return ONLY valid JSON — no explanation, no markdown:
{
  "linkedin_string": "...",
  "indeed_string": "...",
  "explanation": "One sentence explaining what was changed and why"
}`

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 600,
      messages:   [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    return NextResponse.json({
      linkedin_string:  parsed.linkedin_string,
      indeed_string:    parsed.indeed_string,
      explanation:      parsed.explanation,
      refinement_count: currentCount + 1,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to refine string' }, { status: 500 })
  }
}
