import { NextRequest } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { ARIA_SYSTEM_PROMPT } from '@/lib/sales-agent/system-prompt'
import { extractLeadInfo, isQualified } from '@/lib/sales-agent/qualification'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'

const MAX_MESSAGES_PER_SESSION = 50
const MAX_SESSIONS_PER_IP_PER_DAY = 10

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  let body: {
    session_id?: unknown
    messages?: unknown
    is_new_session?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : null
  const isNewSession = body.is_new_session === true
  const rawMessages = Array.isArray(body.messages) ? body.messages : []

  if (!sessionId) {
    return Response.json({ error: 'session_id required' }, { status: 400 })
  }

  // Validate and sanitize messages
  const messages: MessageParam[] = []
  for (const m of rawMessages) {
    if (
      typeof m === 'object' &&
      m !== null &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string'
    ) {
      messages.push({ role: m.role, content: m.content.slice(0, 4000) })
    }
  }

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return Response.json({ error: 'Last message must be from user' }, { status: 400 })
  }

  // Rate limit: message count
  if (messages.length > MAX_MESSAGES_PER_SESSION) {
    return Response.json(
      { error: 'rate_limited', type: 'messages' },
      { status: 429 },
    )
  }

  const clientIp = getClientIp(req)
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // Rate limit: new session IP check
  if (isNewSession) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await db
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .eq('client_ip', clientIp)
      .gte('created_at', since)

    if ((count ?? 0) >= MAX_SESSIONS_PER_IP_PER_DAY) {
      return Response.json(
        { error: 'rate_limited', type: 'sessions' },
        { status: 429 },
      )
    }
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = ''

      try {
        const messageStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 600,
          system: ARIA_SYSTEM_PROMPT,
          messages,
        })

        for await (const chunk of messageStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const token = chunk.delta.text
            fullResponse += token
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ token })}\n\n`),
            )
          }
        }

        // Build updated conversation for extraction
        const updatedConversation = [
          ...messages,
          { role: 'assistant' as const, content: fullResponse },
        ]

        // Extract lead info and upsert after stream completes
        const extracted = await extractLeadInfo(
          updatedConversation.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: typeof m.content === 'string' ? m.content : '',
          })),
        )

        const wasQualified = await checkWasQualified(db, sessionId)
        const nowQualified = isQualified(extracted)

        await db.from('sales_leads').upsert(
          {
            session_id: sessionId,
            client_ip: clientIp,
            conversation_json: updatedConversation,
            name: extracted.name,
            email: extracted.email,
            company: extracted.company,
            team_size: extracted.team_size,
            qualified: nowQualified,
          },
          { onConflict: 'session_id' },
        )

        // Send qualification email on first qualification
        if (nowQualified && !wasQualified) {
          const plainConv = updatedConversation.map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '',
          }))
          await sendQualificationEmail(extracted, plainConv).catch(
            (err) => console.error('[sales-chat] Resend qualification error:', err),
          )
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, extracted })}\n\n`,
          ),
        )
      } catch (err) {
        console.error('[sales-chat] stream error:', err)
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              token:
                "I'm having a technical issue — please email collin@candidai.app directly and we'll get back to you within a few hours.",
            })}\n\n`,
          ),
        )
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, extracted: null })}\n\n`),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

async function checkWasQualified(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  sessionId: string,
): Promise<boolean> {
  try {
    const { data } = await db
      .from('sales_leads')
      .select('qualified')
      .eq('session_id', sessionId)
      .single()
    return data?.qualified === true
  } catch (err) {
    console.error('[sales-chat] checkWasQualified error:', err)
    return false
  }
}

async function sendQualificationEmail(
  extracted: { name: string | null; email: string | null; company: string | null; team_size: string | null },
  conversation: { role: string; content: string }[],
) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? '')

  const transcript = conversation
    .map(
      (m) =>
        `<p><strong>${m.role === 'user' ? 'Prospect' : 'Aria'}:</strong> ${m.content.replace(/\n/g, '<br>')}</p>`,
    )
    .join('')

  await resend.emails.send({
    from: 'Candid.ai <hello@candidai.app>',
    to: 'collin@candidai.app',
    subject: `New qualified lead — ${extracted.company ?? 'Unknown Company'}`,
    html: `
      <h2>New Qualified Lead</h2>
      <table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td><strong>Name</strong></td><td>${extracted.name ?? '—'}</td></tr>
        <tr><td><strong>Email</strong></td><td>${extracted.email ?? '—'}</td></tr>
        <tr><td><strong>Company</strong></td><td>${extracted.company ?? '—'}</td></tr>
        <tr><td><strong>Team Size</strong></td><td>${extracted.team_size ?? '—'}</td></tr>
      </table>
      <hr style="margin:24px 0">
      <h3>Full Conversation</h3>
      ${transcript}
    `,
  })
}
