import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { ROLE_TEMPLATES, type RoleTemplate } from '@/lib/assessment-constants'

function buildPrompt(template: RoleTemplate): string {
  return `Generate 3 starter assessment questions for a mid-level ${template} position.

Return ONLY a valid JSON array of 3 questions — no markdown fences, no explanation, raw JSON only.

Mix question types: include one coding, one multiple choice, and one written question (in any order).

CODING schema:
{
  "type": "coding",
  "language": "javascript" | "typescript" | "react_tsx" | "python",
  "prompt": "Detailed instructions shown to the candidate",
  "starter_code": "Function signature / skeleton — NOT the solution",
  "test_cases": [{"input": "input string", "expectedOutput": "expected output string"}],
  "instructions": "Additional constraints or context",
  "rubric_hints": "What to evaluate: correctness, edge cases, efficiency, readability"
}

MULTIPLE CHOICE schema:
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

WRITTEN schema:
{
  "type": "written",
  "prompt": "Open-ended question targeting real-world decision-making",
  "length_hint": "short" | "medium" | "long",
  "rubric_hints": "Key points a strong answer must address"
}

Requirements:
- Questions must test skills used daily in a ${template} role
- Be specific: avoid generic filler, target what employers genuinely care about
- Return EXACTLY 3 questions in the array`
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

  let body: { template?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { template } = body
  if (!template || !(ROLE_TEMPLATES as readonly string[]).includes(template)) {
    return NextResponse.json({ error: 'Invalid template' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 4096,
    messages:   [{ role: 'user', content: buildPrompt(template as RoleTemplate) }],
  })

  const raw     = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let questions: unknown[]
  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('Expected JSON array')
    questions = parsed
  } catch {
    console.error('Claude returned non-JSON:', cleaned.slice(0, 500))
    return NextResponse.json({ error: 'Claude returned invalid JSON — try again' }, { status: 500 })
  }

  return NextResponse.json({ questions })
}
