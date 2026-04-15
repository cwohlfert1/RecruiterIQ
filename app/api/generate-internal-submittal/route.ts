import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkAIGate } from '@/lib/ai-gate'
import { checkRateLimit, getRateLimitKey, rateLimitResponse, RATE_AI } from '@/lib/security/rate-limit'

const client = new Anthropic()

// POST /api/generate-internal-submittal
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const gate = await checkAIGate(user.id)
  if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 })

  // Rate limit: 20 AI calls/min per user
  const rl = checkRateLimit(getRateLimitKey(req, 'gen-submittal', user.id), RATE_AI)
  if (!rl.allowed) return rateLimitResponse(rl)

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

  const systemPrompt = `You are a senior technical recruiter writing a 4-bullet internal submittal for your account manager. You have read the full resume and JD carefully. Every bullet must reference specific details — company names, years, tools, metrics, project types. Generic bullets are unacceptable.`

  const payRateLine = pay_rate_min
    ? `$${pay_rate_min}${pay_rate_max ? `–$${pay_rate_max}` : '+'}/hr W2`
    : 'Rate not yet discussed.'

  const breakdownStr = cqi_breakdown
    ? Object.entries(cqi_breakdown)
        .filter(([k]) => k !== 'recommendation')
        .map(([k, v]) => `  ${k}: ${(v as { score: number }).score}/100`)
        .join('\n')
    : ''

  const userContent = `Write a 4-bullet internal submittal note for your account manager.

CONTENT RULES:
- Every sentence must reference something specific from the resume — a company name, a tool, a metric, a project type, a team size, anything concrete
- Tie each bullet to what the JD is actually asking for — stated plainly, no sales language
- No phrases like: 'maps cleanly to', 'direct hit', 'I am pleased to present', 'strong communicator', 'team player', or any generic filler
- No emojis
- If the candidate is overqualified, acknowledge it briefly in bullet 4
- If pay rate is provided include it in bullet 4
- If there is a notable gap vs the JD, note it briefly

BULLET TOPICS:
- Bullet 1: Core technical experience — specific years, tools, environments
- Bullet 2: Relevant domain or project type — companies, industries, project scales
- Bullet 3: Strongest differentiator for THIS role — metric or example
- Bullet 4: Rate, availability, and honest assessment

OUTPUT FORMAT — FOLLOW EXACTLY:
• **[Specific Descriptive Label]** – [one sentence max, specific facts from resume]
• **[Specific Descriptive Label]** – [one sentence max, specific facts from resume]
• **[Specific Descriptive Label]** – [one sentence max, specific facts from resume]
• **[Specific Descriptive Label]** – [one sentence max, specific facts from resume]

FORMAT RULES:
- Bullet character: • (not -, not *, not a number)
- Label: bold, wrapped in **, specific and descriptive (NOT generic like 'Experience' or 'Technical Skills')
- Dash: – (em dash, not hyphen)
- Body: exactly 1 sentence after the dash, max 25 words
- 4 bullets minimum, 5 maximum
- No paragraphs, no sub-bullets, no line breaks within a bullet
- Do not add any intro text, summary, or closing statement — bullets only
- If you find yourself writing more than one sentence after the dash, cut it to the strongest one

JD:
${jd_text ? jd_text.slice(0, 3000) : 'Not provided'}

Resume:
${resume_text.slice(0, 6000)}

CQI Score: ${cqi_score !== null && cqi_score !== undefined ? `${cqi_score}/100` : 'not scored'}
${breakdownStr ? `CQI Breakdown:\n${breakdownStr}` : ''}
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
