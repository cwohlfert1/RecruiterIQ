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

  const { jobTitle, requiredSkills, optionalSkills, exclusions } = body

  // 3. Validate inputs
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

  const safeRequired  = (requiredSkills as string[]).map(s => s.trim())
  const safeOptional  = Array.isArray(optionalSkills)
    ? (optionalSkills as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
    : []
  const safeExclusions = Array.isArray(exclusions)
    ? (exclusions as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
    : []

  const safeJobTitle = jobTitle.trim()

  // 4. Build SSE stream with Claude streaming
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        const messageStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 400,
          messages: [
            {
              role: 'user',
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

        // 5. Persist to DB after streaming completes
        const supabase = createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any

        await db.from('boolean_searches').insert({
          user_id:        gate.userId,
          job_title:      safeJobTitle,
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
          encoder.encode(
            `data: ${JSON.stringify({ error: 'Generation failed' })}\n\n`,
          ),
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
