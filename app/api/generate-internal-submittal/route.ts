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

  const systemPrompt = `You are a technical recruiter writing a 4-bullet internal submittal note for your account manager.

RULES:
- Professional but brief — recruiter to AM
- No fluff, no filler phrases
- No "maps cleanly to", "direct hit", "I am pleased to present", or any sales language
- No emojis
- Each bullet: bold label + 1-2 sentences max
- Pull specific skills, years, tools, metrics, and company names directly from the resume
- Each bullet connects what the candidate has to what the JD requires — stated plainly
- If pay rate is provided include it in bullet 4
- Be honest — if there is a gap, note it briefly

FORMAT (follow exactly, output raw markdown):
- **[Skill Area + Tools + Years]** — [what they have, stated factually, tied to JD requirement]
- **[Domain/Industry Experience]** — [relevant background with specifics tied to role context]
- **[Key Differentiator or Strongest Point]** — [what stands out for this specific role, with metrics where available]
- **[Rate & Availability]** — [W2 hourly rate if known + notice period if found in resume. If rate unknown: "Rate TBD — not yet discussed." If there is a notable gap vs JD, note it here]

IMPORTANT:
- Use the candidate's actual resume data only
- Never fabricate numbers, companies, or titles
- If resume lacks detail for a bullet, keep it brief rather than padding it out
- 4 bullets total, no more, no less
- Output only the 4 bullets — no intro, no sign-off, no header`

  const userContent = [
    `RESUME:\n${resume_text.slice(0, 6000)}`,
    jd_text ? `\nJOB DESCRIPTION:\n${jd_text.slice(0, 3000)}` : '',
    cqiContext ? `\n${cqiContext}` : '',
    breakdownContext ? `Score breakdown:\n${breakdownContext}` : '',
    `\n${rateContext}`,
  ].filter(Boolean).join('\n')

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
