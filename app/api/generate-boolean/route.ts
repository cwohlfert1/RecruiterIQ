import { NextRequest } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { checkAIGate, incrementAICallCount } from '@/lib/ai-gate'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // 1. Auth + plan gate — available to all plans
  const gate = await checkAIGate()
  if (!gate.allowed) {
    const status = gate.reason === 'unauthenticated' ? 401 : 403
    return Response.json(
      { error: 'Access denied', reason: gate.reason, planTier: gate.planTier },
      { status },
    )
  }

  // 2. Parse body
  let body: {
    jd_text?: unknown
    jobTitle?: unknown
    requiredSkills?: unknown
    optionalSkills?: unknown
    exclusions?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. Route: Option A (JD paste) or Option B (manual fields)
  // gate.allowed is true here (guarded above), so userId exists
  const gateAllowed = gate as { userId: string }

  if (body.jd_text !== undefined) {
    return handleJdMode(body.jd_text, gateAllowed)
  }
  return handleManualMode(body, gateAllowed)
}

// ─── Option A: JD paste → JSON response ──────────────────────────────────────

async function handleJdMode(
  jdTextRaw: unknown,
  gate: { userId: string },
) {
  if (typeof jdTextRaw !== 'string' || !jdTextRaw.trim()) {
    return Response.json({ error: 'Job description is required' }, { status: 400 })
  }

  const jdText = jdTextRaw.trim().slice(0, 8000) // ~2000 words safety cap

  const prompt = `You are a Boolean search string expert for technical recruiting.

Job Description:
${jdText}

From this job description:
1. Extract the job title and top 5-8 required skills
2. Generate a LinkedIn boolean search string and an Indeed search string

LinkedIn string rules:
- Use AND, OR, NOT, parentheses, quoted phrases
- Optimize for LinkedIn Recruiter syntax

Indeed string rules:
- Space-separated terms, minus sign for exclusions (no AND/OR/parentheses)

Return ONLY valid JSON (no markdown, no explanation):
{
  "extracted_title": "job title here",
  "extracted_skills": ["skill1", "skill2", "skill3"],
  "linkedin_string": "(title OR synonym) AND (skill1 OR skill2) NOT junior",
  "indeed_string": "title skill1 skill2 -junior -intern"
}`

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 600,
      messages:   [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object in response')

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.linkedin_string || !parsed.indeed_string) throw new Error('Invalid response format')

    // Persist
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    await db.from('boolean_searches').insert({
      user_id:         gate.userId,
      job_title:       parsed.extracted_title ?? 'JD-based search',
      required_skills: Array.isArray(parsed.extracted_skills) ? parsed.extracted_skills : [],
      optional_skills: [],
      exclusions:      [],
      boolean_output:  parsed.linkedin_string,
    })
    await db.from('activity_log').insert({
      user_id:     gate.userId,
      feature:     'boolean',
      description: `Generated Boolean strings from job description`,
    })
    await incrementAICallCount(gate.userId)

    return Response.json({
      extracted_title:  parsed.extracted_title  ?? '',
      extracted_skills: Array.isArray(parsed.extracted_skills) ? parsed.extracted_skills : [],
      linkedin_string:  parsed.linkedin_string,
      indeed_string:    parsed.indeed_string,
    })
  } catch (err) {
    console.error('[generate-boolean jd-mode]', err)
    return Response.json({ error: 'Failed to generate from job description' }, { status: 500 })
  }
}

// ─── Option B: Manual fields → SSE stream ────────────────────────────────────

async function handleManualMode(
  body: {
    jobTitle?: unknown
    requiredSkills?: unknown
    optionalSkills?: unknown
    exclusions?: unknown
  },
  gate: { userId: string },
) {
  const { jobTitle, requiredSkills, optionalSkills, exclusions } = body

  // Validate
  if (typeof jobTitle !== 'string' || !jobTitle.trim()) {
    return Response.json({ error: 'Job title is required' }, { status: 400 })
  }
  if (jobTitle.trim().length > 100) {
    return Response.json({ error: 'Job title must be 100 characters or fewer' }, { status: 400 })
  }
  if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
    return Response.json({ error: 'At least one required skill is needed' }, { status: 400 })
  }
  if (requiredSkills.length > 10) {
    return Response.json({ error: 'Maximum 10 required skills allowed' }, { status: 400 })
  }
  for (const skill of requiredSkills) {
    if (typeof skill !== 'string' || skill.trim().length === 0) {
      return Response.json({ error: 'Required skills must be non-empty strings' }, { status: 400 })
    }
    if (skill.trim().length > 50) {
      return Response.json({ error: 'Each required skill must be 50 characters or fewer' }, { status: 400 })
    }
  }

  const safeRequired   = (requiredSkills as string[]).map(s => s.trim())
  const safeOptional   = Array.isArray(optionalSkills)
    ? (optionalSkills as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
    : []
  const safeExclusions = Array.isArray(exclusions)
    ? (exclusions as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
    : []
  const safeJobTitle   = jobTitle.trim()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        const messageStream = anthropic.messages.stream({
          model:      MODEL,
          max_tokens: 400,
          messages: [
            {
              role:    'user',
              content: `Generate a Boolean search string for LinkedIn Recruiter/Indeed sourcing.

Job Title: ${safeJobTitle}
Required Skills: ${safeRequired.join(', ')}
Optional Skills: ${safeOptional.length > 0 ? safeOptional.join(', ') : 'None'}
Exclusions: ${safeExclusions.length > 0 ? safeExclusions.join(', ') : 'None'}

Rules:
- Use AND for required skills
- Use OR in parentheses for related alternatives
- Use NOT for exclusions
- Use quotes for exact phrases (2+ words)
- Optimize for LinkedIn Recruiter syntax
- Output ONLY the Boolean string, no explanation`,
            },
          ],
        })

        for await (const chunk of messageStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const token = chunk.delta.text
            fullText += token
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
            )
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))

        // Persist
        const supabase = createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any

        await db.from('boolean_searches').insert({
          user_id:         gate.userId,
          job_title:       safeJobTitle,
          required_skills: safeRequired,
          optional_skills: safeOptional,
          exclusions:      safeExclusions,
          boolean_output:  fullText,
        })
        await db.from('activity_log').insert({
          user_id:     gate.userId,
          feature:     'boolean',
          description: `Generated Boolean string for ${safeJobTitle}`,
        })
        await incrementAICallCount(gate.userId)
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Generation failed' })}\n\n`),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
