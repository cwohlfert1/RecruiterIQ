import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { checkAIGate, incrementAICallCount } from '@/lib/ai-gate'
import { createClient } from '@/lib/supabase/server'
import type { BreakdownJson } from '@/types/database'

interface ClaudeBreakdownCategory {
  score: number
  weight: number
  weighted: number
  explanation: string
}

interface ClaudeResponse {
  overall_score: number
  job_title: string
  breakdown: {
    must_have_skills:  ClaudeBreakdownCategory
    domain_experience: ClaudeBreakdownCategory
    communication:     ClaudeBreakdownCategory
    tenure_stability:  ClaudeBreakdownCategory
    tool_depth:        ClaudeBreakdownCategory
  }
}

export async function POST(req: NextRequest) {
  // 1. Auth + plan gate
  const gate = await checkAIGate()
  if (!gate.allowed) {
    const status = gate.reason === 'unauthenticated' ? 401 : 403
    return NextResponse.json({ error: gate.reason }, { status })
  }

  // 2. Parse and validate inputs
  let body: { jd_text?: unknown; resume_text?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { jd_text, resume_text } = body

  if (typeof jd_text !== 'string' || !jd_text.trim()) {
    return NextResponse.json({ error: 'jd_text is required' }, { status: 400 })
  }
  if (typeof resume_text !== 'string' || !resume_text.trim()) {
    return NextResponse.json({ error: 'resume_text is required' }, { status: 400 })
  }
  if (!validateWordCount(jd_text, 2000)) {
    return NextResponse.json({ error: 'Job description exceeds 2000 words' }, { status: 400 })
  }
  if (!validateWordCount(resume_text, 5000)) {
    return NextResponse.json({ error: 'Resume exceeds 5000 words' }, { status: 400 })
  }

  // 3. Call Claude API
  const systemPrompt =
    'You are an expert technical recruiter. Evaluate the resume against the job description.\n' +
    'Return ONLY valid JSON, no markdown, no explanation outside the JSON.'

  const userPrompt = `Score this resume against this job description using these exact weights:
- Must-Have Skills Match: 40% (does candidate have the required skills?)
- Domain/Industry Experience: 20% (relevant industry background?)
- Communication & Clarity: 15% (how well-written and clear is the resume?)
- Tenure Stability: 10% (consistent employment history, not job-hopping?)
- Depth of Tool Usage: 15% (depth of experience with relevant tools?)

For each category: score 0-100, plus one concise sentence explanation.
Calculate overall score as weighted sum.

Job Description:
${jd_text}

Resume:
${resume_text}

Return ONLY this JSON structure:
{
  "overall_score": <integer 0-100>,
  "job_title": "<extracted job title from JD or empty string>",
  "breakdown": {
    "must_have_skills":  { "score": <0-100>, "weight": 0.40, "weighted": <score*0.40 rounded>, "explanation": "<sentence>" },
    "domain_experience": { "score": <0-100>, "weight": 0.20, "weighted": <score*0.20 rounded>, "explanation": "<sentence>" },
    "communication":     { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<sentence>" },
    "tenure_stability":  { "score": <0-100>, "weight": 0.10, "weighted": <score*0.10 rounded>, "explanation": "<sentence>" },
    "tool_depth":        { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<sentence>" }
  }
}`

  let claudeData: ClaudeResponse
  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    claudeData = JSON.parse(cleaned) as ClaudeResponse
  } catch {
    return NextResponse.json({ error: 'Failed to get or parse Claude response' }, { status: 500 })
  }

  const { overall_score, job_title, breakdown } = claudeData

  // 4. Save to Supabase
  const supabase = createClient()

  const breakdownJson: BreakdownJson = {
    must_have_skills:  {
      score:    breakdown.must_have_skills.score,
      weight:   breakdown.must_have_skills.weight,
      weighted: breakdown.must_have_skills.weighted,
    },
    domain_experience: {
      score:    breakdown.domain_experience.score,
      weight:   breakdown.domain_experience.weight,
      weighted: breakdown.domain_experience.weighted,
    },
    communication: {
      score:    breakdown.communication.score,
      weight:   breakdown.communication.weight,
      weighted: breakdown.communication.weighted,
    },
    tenure_stability: {
      score:    breakdown.tenure_stability.score,
      weight:   breakdown.tenure_stability.weight,
      weighted: breakdown.tenure_stability.weighted,
    },
    tool_depth: {
      score:    breakdown.tool_depth.score,
      weight:   breakdown.tool_depth.weight,
      weighted: breakdown.tool_depth.weighted,
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: scoreRow, error: insertError } = await db
    .from('resume_scores')
    .insert({
      user_id:        gate.userId,
      job_title:      job_title || null,
      resume_text,
      jd_text,
      score:          overall_score,
      breakdown_json: breakdownJson,
    })
    .select('id')
    .single()

  if (insertError || !scoreRow) {
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 })
  }

  // 5. Log activity
  await db.from('activity_log').insert({
    user_id:     gate.userId,
    feature:     'resume_scorer',
    record_id:   scoreRow.id,
    description: `Scored resume for ${job_title || 'position'} — ${overall_score}/100`,
  })

  // 6. Increment AI call count
  await incrementAICallCount(gate.userId)

  // 7. Return result — include explanations for the page
  return NextResponse.json({
    score:     overall_score,
    job_title: job_title || '',
    record_id: scoreRow.id,
    breakdown: {
      must_have_skills:  {
        ...breakdownJson.must_have_skills,
        explanation: breakdown.must_have_skills.explanation,
      },
      domain_experience: {
        ...breakdownJson.domain_experience,
        explanation: breakdown.domain_experience.explanation,
      },
      communication: {
        ...breakdownJson.communication,
        explanation: breakdown.communication.explanation,
      },
      tenure_stability: {
        ...breakdownJson.tenure_stability,
        explanation: breakdown.tenure_stability.explanation,
      },
      tool_depth: {
        ...breakdownJson.tool_depth,
        explanation: breakdown.tool_depth.explanation,
      },
    },
  })
}
