import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkAIGate } from '@/lib/ai-gate'
import { checkRateLimit, getRateLimitKey, rateLimitResponse, RATE_AI } from '@/lib/security/rate-limit'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const gate = await checkAIGate(user.id)
  if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 })

  const rl = checkRateLimit(getRateLimitKey(req, 'gen-client-submittal', user.id), RATE_AI)
  if (!rl.allowed) return rateLimitResponse(rl)

  let body: {
    resume_text?: string
    jd_text?: string | null
    cqi_score?: number | null
    cqi_breakdown?: Record<string, { score: number; weight: number }> | null
    candidate_name?: string
    job_title?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { resume_text, jd_text, cqi_score, cqi_breakdown, candidate_name, job_title } = body
  if (!resume_text) return NextResponse.json({ error: 'resume_text required' }, { status: 400 })

  const breakdownStr = cqi_breakdown
    ? Object.entries(cqi_breakdown)
        .filter(([k]) => k !== 'recommendation')
        .map(([k, v]) => `  ${k}: ${v.score}/100`)
        .join('\n')
    : ''

  const systemPrompt = `You are a senior technical recruiter writing a formal client-facing candidate submittal. This will be sent directly to a hiring manager or client contact — it must be polished, confident, and professional.`

  const userContent = `Write a client-facing candidate submittal for ${candidate_name ?? 'this candidate'} for the ${job_title ?? 'role'}.

OUTPUT FORMAT — FOLLOW EXACTLY:
• **[Specific Skill/Strength + Years/Tools]** – [1-2 sentence explanation with real metrics and specifics from resume, tied to JD requirement]
• **[Specific Skill/Strength]** – [1-2 sentence explanation]
• **[Specific Skill/Strength]** – [1-2 sentence explanation]
• **[Specific Skill/Strength or Differentiator]** – [1-2 sentence explanation]

LABEL RULES — CRITICAL:
- Labels must be SPECIFIC and DESCRIPTIVE — never generic
- BAD: Experience, Technical Skills, Domain Experience
- GOOD: Boomi-Centric Integration Engineer (4+ Years), Proven Automation & Efficiency Gains, Enterprise System Exposure (12+ Systems)
- Labels should read like headlines that make the hiring manager lean forward
- Include specific tools, years, metrics, or outcomes in the label where possible

FORMAT RULES:
- Bullet character: • (not -, not *, not a number)
- Label: bold, wrapped in **, specific and descriptive
- Dash: – (em dash, not hyphen)
- 4-5 bullets total
- Pull real numbers, company names, tools, and outcomes directly from the resume
- Tailor every bullet to the JD requirements
- Confident, client-ready tone — this is going to a hiring manager
- No fluff, no filler, no emojis
- No intro text, no closing statement — bullets only

JD:
${jd_text ? jd_text.slice(0, 3000) : 'Not provided'}

Resume:
${resume_text.slice(0, 6000)}

CQI Score: ${cqi_score != null ? `${cqi_score}/100` : 'not scored'}
${breakdownStr ? `CQI Breakdown:\n${breakdownStr}` : ''}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 })
    }

    return NextResponse.json({ submittal: content.text.trim() })
  } catch (err) {
    console.error('[generate-client-submittal] error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
