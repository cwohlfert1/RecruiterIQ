import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'

function buildPrompt(jdText: string): string {
  return `Analyze this job description and extract structured assessment data.

JOB DESCRIPTION:
${jdText}

Return ONLY a valid JSON object — no markdown fences, no explanation, raw JSON only.

Schema:
{
  "title": "Assessment title based on the role (e.g. 'Senior React Developer Assessment')",
  "role": "Job title extracted from JD (e.g. 'Senior React Developer')",
  "difficulty": "junior" | "mid" | "senior",
  "time_limit_minutes": number between 30 and 120,
  "detected_skills": ["skill1", "skill2", ...],
  "suggested_questions": [ /* 3-5 questions, see schemas below */ ],
  "suggested_proctoring": {
    "tab_switching": true,
    "paste_detection": true,
    "eye_tracking": false,
    "keystroke_dynamics": true,
    "presence_challenges": true,
    "presence_challenge_frequency": 2,
    "snapshots": false
  }
}

For suggested_questions, use these schemas:

CODING:
{
  "type": "coding",
  "language": "javascript" | "typescript" | "react_tsx" | "python",
  "prompt": "Detailed instructions shown to the candidate",
  "starter_code": "Function signature / skeleton — NOT the solution",
  "test_cases": [{"input": "input string", "expectedOutput": "expected output string"}],
  "instructions": "Additional constraints or context",
  "rubric_hints": "What to evaluate: correctness, edge cases, efficiency, readability"
}

MULTIPLE CHOICE:
{
  "type": "multiple_choice",
  "prompt": "The question — clear, unambiguous, tests real knowledge",
  "options": [
    {"id": "a", "text": "Option A", "is_correct": false},
    {"id": "b", "text": "Option B", "is_correct": true},
    {"id": "c", "text": "Option C", "is_correct": false},
    {"id": "d", "text": "Option D", "is_correct": false}
  ],
  "correct_option": "b",
  "rubric_hints": "Why the correct answer is right"
}

WRITTEN:
{
  "type": "written",
  "prompt": "Open-ended question targeting real-world decision-making",
  "length_hint": "short" | "medium" | "long",
  "rubric_hints": "Key points a strong answer must address"
}

Requirements:
- difficulty: infer from experience level (junior: 0-2yr, mid: 2-5yr, senior: 5+yr)
- detected_skills: 3-8 specific technical skills mentioned in the JD
- suggested_questions: 3-5 questions that directly test skills required for this role. Mix types.
- Include at least one coding and one written question in suggested_questions
- time_limit_minutes: scale with number of questions and difficulty (30-120)
- suggested_proctoring: enable eye_tracking and snapshots for senior roles`
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: profile } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'manager') {
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })
  }

  let body: { jd_text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { jd_text } = body
  if (!jd_text?.trim() || jd_text.trim().length < 50) {
    return NextResponse.json({ error: 'jd_text must be at least 50 characters' }, { status: 400 })
  }

  console.log('[analyze-jd] JD length:', jd_text.trim().length, 'chars')

  let message
  try {
    message = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 4096,
      messages:   [{ role: 'user', content: buildPrompt(jd_text.trim().slice(0, 8000)) }],
    })
  } catch (err) {
    console.error('[analyze-jd] Anthropic API error:', err)
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    if (errMsg.includes('401') || errMsg.includes('auth')) {
      return NextResponse.json({ error: 'AI service authentication failed — contact support' }, { status: 500 })
    }
    if (errMsg.includes('429') || errMsg.includes('rate')) {
      return NextResponse.json({ error: 'AI service is busy — wait a moment and try again' }, { status: 429 })
    }
    return NextResponse.json({ error: `AI analysis failed: ${errMsg.slice(0, 100)}` }, { status: 500 })
  }

  const raw     = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  if (!cleaned) {
    console.error('[analyze-jd] Empty response from Claude')
    return NextResponse.json({ error: 'AI returned an empty response — try a shorter JD' }, { status: 500 })
  }

  let result: unknown
  try {
    // Handle case where Claude wraps JSON in extra text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object found in response')
    result = JSON.parse(jsonMatch[0])
    if (typeof result !== 'object' || result === null) throw new Error('Expected JSON object')
  } catch (parseErr) {
    console.error('[analyze-jd] JSON parse error:', parseErr, '\nRaw response:', cleaned.slice(0, 500))
    return NextResponse.json({ error: 'AI returned an unexpected format — try again' }, { status: 500 })
  }

  return NextResponse.json(result)
}
