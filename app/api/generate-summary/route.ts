import { NextRequest } from 'next/server'
import { anthropic, MODEL, validateWordCount } from '@/lib/anthropic'
import { checkAIGate, incrementAICallCount } from '@/lib/ai-gate'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // 1. Auth + plan gate — Pro and above required
  const gate = await checkAIGate('pro')
  if (!gate.allowed) {
    const status = gate.reason === 'unauthenticated' ? 401 : 403
    return Response.json(
      { error: 'Access denied', reason: gate.reason, planTier: gate.planTier },
      { status },
    )
  }

  // 2. Parse body
  let body: { jobTitle?: unknown; companyName?: unknown; notes?: unknown; assessmentSessionId?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { jobTitle, companyName, notes, assessmentSessionId } = body

  // 3. Validate inputs
  if (typeof jobTitle !== 'string' || !jobTitle.trim()) {
    return Response.json({ error: 'Job title is required' }, { status: 400 })
  }
  if (jobTitle.trim().length > 100) {
    return Response.json({ error: 'Job title must be 100 characters or fewer' }, { status: 400 })
  }
  if (typeof notes !== 'string' || !notes.trim()) {
    return Response.json({ error: 'Notes are required' }, { status: 400 })
  }
  if (!validateWordCount(notes, 500)) {
    return Response.json({ error: 'Notes must be 500 words or fewer' }, { status: 400 })
  }

  const safeCompany   = typeof companyName === 'string' ? companyName.trim() : ''
  const safeSessionId = typeof assessmentSessionId === 'string' ? assessmentSessionId.trim() : null

  // Optionally fetch assessment session data
  let assessmentContext = ''
  if (safeSessionId) {
    const supabaseForLookup = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbLookup = supabaseForLookup as any
    const { data: sessionData } = await dbLookup
      .from('assessment_sessions')
      .select('trust_score, skill_score, completed_at, assessments(title, role)')
      .eq('id', safeSessionId)
      .eq('status', 'completed')
      .single()

    if (sessionData) {
      const completedDate = sessionData.completed_at
        ? new Date(sessionData.completed_at).toLocaleDateString()
        : 'recently'
      assessmentContext = `

Assessment Results:
- Role Assessed: ${(sessionData.assessments as { title: string; role: string } | null)?.title ?? 'Technical Assessment'}
- Skill Score: ${sessionData.skill_score ?? 'N/A'}/100
- Trust Score (integrity): ${sessionData.trust_score ?? 'N/A'}/100
- Date Completed: ${completedDate}

Incorporate these results naturally into Bullet 4 of the summary. Example format: "Completed [Role] technical assessment with a Skill Score of [X]/100 and a clean integrity report — verified by Candid.ai."`
    }
  }

  // 4. Build SSE stream with Claude streaming
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        const messageStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 600,
          messages: [
            {
              role: 'user',
              content: `You are a professional recruiter writing a client brief. Based on these notes, write a polished ${safeSessionId ? '4' : '3'}-paragraph summary brief for this client engagement.

Job Title: ${jobTitle.trim()}
Company: ${safeCompany || 'Not specified'}
Notes: ${notes}${assessmentContext}

Write ${safeSessionId ? '4' : '3'} paragraphs:
1. The opportunity (role + company context)
2. What they're looking for (key requirements)
3. Why this is a good opportunity${safeSessionId ? '\n4. Assessment verification (use the assessment results above — keep it factual and brief)' : ''}

Be professional, concise, and compelling. No fluff.`,
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

        await db.from('client_summaries').insert({
          user_id:               gate.userId,
          job_title:             jobTitle.trim(),
          company_name:          safeCompany || null,
          input_notes:           notes,
          summary_output:        fullText,
          assessment_session_id: safeSessionId || null,
        })

        await db.from('activity_log').insert({
          user_id:     gate.userId,
          feature:     'summary',
          description: `Generated summary for ${jobTitle.trim()}${safeCompany ? ` at ${safeCompany}` : ''}`,
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
