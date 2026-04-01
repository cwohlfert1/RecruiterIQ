import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'

const SKILL_FOCUSES = [
  'React', 'JavaScript', 'TypeScript', 'Python', 'SQL',
  'System Design', 'CSS/HTML', 'Node.js', 'Git/DevOps', 'Behavioral/Soft Skills',
] as const

const DIFFICULTIES  = ['junior', 'mid', 'senior'] as const
const QUESTION_TYPES = ['coding', 'multiple_choice', 'written'] as const

type SkillFocus    = typeof SKILL_FOCUSES[number]
type Difficulty    = typeof DIFFICULTIES[number]
type QuestionType  = typeof QUESTION_TYPES[number]
type Language      = 'javascript' | 'typescript' | 'react_jsx' | 'react_tsx' | 'python'

function preferredLanguage(skill: SkillFocus): Language {
  switch (skill) {
    case 'React':      return 'react_tsx'
    case 'TypeScript': return 'typescript'
    case 'Python':     return 'python'
    default:           return 'javascript'
  }
}

function buildPrompt(
  role: string,
  skill: SkillFocus,
  difficulty: Difficulty,
  types: QuestionType[],
  count: number,
): string {
  const lang        = preferredLanguage(skill)
  const hasCoding   = types.includes('coding')
  const hasMC       = types.includes('multiple_choice')
  const hasWritten  = types.includes('written')
  const diffHint    = difficulty === 'junior'
    ? 'fundamentals, syntax, basic patterns'
    : difficulty === 'mid'
      ? 'architecture, debugging, practical real-world patterns'
      : 'system design, performance trade-offs, advanced patterns'

  return `Generate ${count} assessment question(s) for a ${difficulty}-level ${role} position focusing on ${skill}.

Question type(s) to generate: ${types.join(', ')}.${
    types.length > 1
      ? ` Distribute the ${count} questions across the types as evenly as possible.`
      : ''
  }

Return ONLY a valid JSON array — no markdown fences, no explanation, raw JSON only.

${hasCoding ? `CODING question schema:
{
  "type": "coding",
  "language": "${lang}",
  "prompt": "Detailed instructions shown to the candidate",
  "starter_code": "Function signature / skeleton — NOT the solution",
  "test_cases": [{"input": "input string", "expectedOutput": "expected output string"}],
  "instructions": "Additional constraints or context",
  "rubric_hints": "What to evaluate: correctness, edge cases, efficiency, readability"
}
Rules for coding: use language "${lang}". For react_jsx/react_tsx use empty array [] for test_cases. For SQL focus use javascript language with a schema comment in starter_code.
` : ''}${hasMC ? `MULTIPLE CHOICE question schema:
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
Rules for MC: exactly 4 options (ids a/b/c/d), exactly 1 correct, distractors must be plausible.
` : ''}${hasWritten ? `WRITTEN RESPONSE question schema:
{
  "type": "written",
  "prompt": "Open-ended question targeting real-world decision-making",
  "length_hint": "short" | "medium" | "long",
  "rubric_hints": "Key points a strong answer must address"
}
` : ''}
Requirements:
- Difficulty: ${difficulty} (${diffHint})
- Skill focus: ${skill} — all questions must directly test this area
- Role context: ${role} — questions should reflect actual job responsibilities
- Be specific: avoid generic filler, target skills employers genuinely care about
- Return EXACTLY ${count} element(s) in the array`
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

  let body: {
    role?:           string
    skill_focus?:    string
    difficulty?:     string
    question_types?: string[]
    count?:          number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { role, skill_focus, difficulty, question_types, count } = body

  if (!role?.trim()) {
    return NextResponse.json({ error: 'role is required' }, { status: 400 })
  }
  if (!skill_focus || !(SKILL_FOCUSES as readonly string[]).includes(skill_focus)) {
    return NextResponse.json({ error: 'Invalid skill_focus' }, { status: 400 })
  }
  if (!difficulty || !(DIFFICULTIES as readonly string[]).includes(difficulty)) {
    return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })
  }
  if (!Array.isArray(question_types) || question_types.length === 0) {
    return NextResponse.json({ error: 'At least one question_type required' }, { status: 400 })
  }

  const validTypes = question_types.filter(
    (t): t is QuestionType => (QUESTION_TYPES as readonly string[]).includes(t)
  )
  if (validTypes.length === 0) {
    return NextResponse.json({ error: 'No valid question types' }, { status: 400 })
  }

  const questionCount = Math.min(Math.max(1, count ?? 3), 5)

  const prompt = buildPrompt(
    role.trim(),
    skill_focus as SkillFocus,
    difficulty as Difficulty,
    validTypes,
    questionCount,
  )

  const message = await anthropic.messages.create({
    model:      MODEL,
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  // Strip accidental markdown fences
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
