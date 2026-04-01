import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'

const DIFFICULTIES  = ['junior', 'mid', 'senior'] as const
const QUESTION_TYPES = ['coding', 'multiple_choice', 'written'] as const

type Difficulty   = typeof DIFFICULTIES[number]
type QuestionType = typeof QUESTION_TYPES[number]

function buildPrompt(type: QuestionType, role: string, difficulty: Difficulty): string {
  const diffHint = difficulty === 'junior'
    ? 'fundamentals, syntax, basic patterns'
    : difficulty === 'mid'
      ? 'architecture, debugging, practical real-world patterns'
      : 'system design, performance trade-offs, advanced patterns'

  const schema =
    type === 'coding' ? `{
  "type": "coding",
  "language": "javascript" | "typescript" | "react_tsx" | "python",
  "prompt": "Detailed instructions shown to the candidate",
  "starter_code": "Function signature / skeleton — NOT the solution",
  "test_cases": [{"input": "input string", "expectedOutput": "expected output string"}],
  "instructions": "Additional constraints or context",
  "rubric_hints": "What to evaluate: correctness, edge cases, efficiency, readability"
}` : type === 'multiple_choice' ? `{
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
}` : `{
  "type": "written",
  "prompt": "Open-ended question targeting real-world decision-making",
  "length_hint": "short" | "medium" | "long",
  "rubric_hints": "Key points a strong answer must address"
}`

  return `Generate 1 fresh ${type} assessment question for a ${difficulty}-level ${role} position.

Return ONLY a valid JSON object — no markdown fences, no explanation, raw JSON only.

Schema:
${schema}

Requirements:
- Difficulty: ${difficulty} (${diffHint})
- Role context: ${role}
- Be specific: avoid generic filler, target skills employers genuinely care about`
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

  let body: { question_type?: string; role?: string; difficulty?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { question_type, role, difficulty = 'mid' } = body

  if (!question_type || !(QUESTION_TYPES as readonly string[]).includes(question_type)) {
    return NextResponse.json({ error: 'Invalid question_type' }, { status: 400 })
  }
  if (!role?.trim()) {
    return NextResponse.json({ error: 'role is required' }, { status: 400 })
  }
  if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) {
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })
  }

  const message = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 2048,
    messages:   [{ role: 'user', content: buildPrompt(question_type as QuestionType, role.trim(), difficulty as Difficulty) }],
  })

  const raw     = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let question: unknown
  try {
    question = JSON.parse(cleaned)
    if (typeof question !== 'object' || question === null) throw new Error('Expected JSON object')
  } catch {
    console.error('Claude returned non-JSON:', cleaned.slice(0, 500))
    return NextResponse.json({ error: 'Claude returned invalid JSON — try again' }, { status: 500 })
  }

  return NextResponse.json({ question })
}
