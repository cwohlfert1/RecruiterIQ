import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkAIGate } from '@/lib/ai-gate'

const client = new Anthropic()

// POST /api/generate-internal-submittal
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const gate = await checkAIGate(user.id)
  if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 })

  let body: {
    candidate_id:   string
    project_id:     string
    resume_text:    string
    jd_text?:       string | null
    cqi_score?:     number | null
    cqi_breakdown?: Record<string, { score: number; weight: number }> | null
    pay_rate_min?:  number | null
    pay_rate_max?:  number | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { resume_text, jd_text, cqi_score, cqi_breakdown, pay_rate_min, pay_rate_max } = body
  if (!resume_text) return NextResponse.json({ error: 'resume_text required' }, { status: 400 })

  // Build context block for Claude
  const rateContext = pay_rate_min
    ? `Candidate rate: $${pay_rate_min}${pay_rate_max ? `–${pay_rate_max}` : '+'}/hr W2`
    : 'Rate not yet discussed.'

  const cqiContext = cqi_score !== null && cqi_score !== undefined
    ? `CQI Score: ${cqi_score}/100`
    : ''

  const breakdownContext = cqi_breakdown
    ? Object.entries(cqi_breakdown)
        .map(([k, v]) => `  ${k}: ${v.score}/100`)
        .join('\n')
    : ''

  const systemPrompt = `You are a senior technical recruiter writing a candidate sell summary for a hiring manager. Your job is to market the candidate concisely and confidently. Match the tone of a strong recruiter pitching a candidate they believe in.`

  const payRateLine = pay_rate_min
    ? `${pay_rate_min}${pay_rate_max ? `–${pay_rate_max}` : '+'}/hr W2`
    : 'not provided'

  const topAreas = cqi_breakdown
    ? Object.entries(cqi_breakdown)
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 3)
        .map(([k, v]) => `${k} (${v.score}/100)`)
        .join(', ')
    : 'not available'

  const userContent = `Write a candidate sell summary using the resume and job description below.

Requirements:
- 4-5 bullet points only
- Each bullet starts with a **bolded skill, qualification, or strength**
- Follow the bold with a dash and 1 sentence max of specific explanation
- Focus on: relevant experience, technical tools, certifications, communication and stakeholder skills
- Tone: confident, professional, slightly sales-oriented — this is meant to market the candidate
- No fluff, no generic phrases, no long sentences
- Prioritize clarity and impact over detail
- Tailor bullets to align with the job description where possible
- Lead with the most differentiating or standout experience first
- If pay rate is provided include it as the final bullet

Output format exactly:
- **[Skill/Strength]** – brief explanation
- **[Skill/Strength]** – brief explanation
- **[Skill/Strength]** – brief explanation
- **[Skill/Strength]** – brief explanation

Job Description:
${jd_text ? jd_text.slice(0, 3000) : 'Not provided'}

Resume:
${resume_text.slice(0, 6000)}

CQI Score: ${cqi_score !== null && cqi_score !== undefined ? `${cqi_score}/100` : 'not available'}
Top scoring areas: ${topAreas}
Pay Rate: ${payRateLine}`

  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 600,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userContent }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 })
    }

    return NextResponse.json({ submittal: content.text.trim() })
  } catch (err) {
    console.error('generate-internal-submittal error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
