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

  const userPrompt = `Score this resume against this job description using the CQI (Candidate Quality Index) framework.

Scoring categories and weights:
- Technical Fit (40%): exact match to required tools/stack and depth of hands-on experience
- Domain Experience (15%): relevance of industry background and environment
- Scope & Impact (15%): ownership, complexity, and measurable contributions
- Communication (15%): clarity, articulation, and stakeholder interaction signals from the resume
- Catfish Risk (15%): inconsistencies, vague experience, or overinflated skills — score 0-100 where 100 = very high risk

IMPORTANT for Catfish Risk: this score is INVERTED when computing overall_score.
A candidate with catfish_risk score of 0 (no red flags) contributes the full 15 points.
A candidate with catfish_risk score of 100 (extreme red flags) contributes 0 points.

Weighted contribution formula:
- technical_fit:     score * 0.40
- domain_experience: score * 0.15
- scope_impact:      score * 0.15
- communication:     score * 0.15
- catfish_risk:      (100 - score) * 0.15

overall_score = sum of all weighted contributions (integer 0-100)

recommendation:
- "Strong Submit" if overall_score >= 85
- "Submit" if overall_score 70-84
- "Borderline" if overall_score 55-69
- "Pass" if overall_score < 55

Job Description:
${jd_text}

Resume:
${resume_text}

Return ONLY this JSON structure:
{
  "overall_score": <integer 0-100>,
  "job_title": "<extracted job title from JD or empty string>",
  "recommendation": "<Strong Submit|Submit|Borderline|Pass>",
  "breakdown": {
    "technical_fit":     { "score": <0-100>, "weight": 0.40, "weighted": <score*0.40 rounded>, "explanation": "<sentence>" },
    "domain_experience": { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<sentence>" },
    "scope_impact":      { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<sentence>" },
    "communication":     { "score": <0-100>, "weight": 0.15, "weighted": <score*0.15 rounded>, "explanation": "<sentence>" },
    "catfish_risk":      { "score": <0-100>, "weight": 0.15, "weighted": <(100-score)*0.15 rounded>, "explanation": "<sentence>" }
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

  const { overall_score, job_title, recommendation, breakdown } = claudeData

  // 4. Save to Supabase
  const supabase = createClient()

  const breakdownJson: BreakdownJson = {
    technical_fit: {
      score:    breakdown.technical_fit.score,
      weight:   0.40,
      weighted: Math.round(breakdown.technical_fit.score * 0.40),
    },
    domain_experience: {
      score:    breakdown.domain_experience.score,
      weight:   0.15,
      weighted: Math.round(breakdown.domain_experience.score * 0.15),
    },
    scope_impact: {
      score:    breakdown.scope_impact.score,
      weight:   0.15,
      weighted: Math.round(breakdown.scope_impact.score * 0.15),
    },
    communication: {
      score:    breakdown.communication.score,
      weight:   0.15,
      weighted: Math.round(breakdown.communication.score * 0.15),
    },
    catfish_risk: {
      score:    breakdown.catfish_risk.score,
      weight:   0.15,
      weighted: Math.round((100 - breakdown.catfish_risk.score) * 0.15),
    },
  }
  // recommendation stored in JSONB alongside breakdown categories
  const breakdownJsonWithRec = { ...breakdownJson, recommendation } as typeof breakdownJson & { recommendation: typeof recommendation }

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
      breakdown_json: breakdownJsonWithRec,
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
    score:          overall_score,
    job_title:      job_title || '',
    recommendation: recommendation || null,
    record_id:      scoreRow.id,
    breakdown: {
      technical_fit: {
        ...breakdownJson.technical_fit,
        explanation: breakdown.technical_fit.explanation,
      },
      domain_experience: {
        ...breakdownJson.domain_experience,
        explanation: breakdown.domain_experience.explanation,
      },
      scope_impact: {
        ...breakdownJson.scope_impact,
        explanation: breakdown.scope_impact.explanation,
      },
      communication: {
        ...breakdownJson.communication,
        explanation: breakdown.communication.explanation,
      },
      catfish_risk: {
        ...breakdownJson.catfish_risk,
        explanation: breakdown.catfish_risk.explanation,
      },
    },
  })
}
