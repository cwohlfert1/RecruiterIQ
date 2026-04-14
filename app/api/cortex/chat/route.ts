import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { anthropic, MODEL } from '@/lib/anthropic'
import { buildCortexSystemPrompt } from '@/lib/cortex/system-prompt'
import { checkRateLimit, getRateLimitKey, rateLimitResponse } from '@/lib/security/rate-limit'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'

const RATE_CORTEX = { max: 10, windowSec: 60 }

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthenticated' }), { status: 401 })

  // Agency plan gate
  const { data: profile } = await supabase.from('user_profiles').select('plan_tier').eq('user_id', user.id).single()
  if (!profile || profile.plan_tier !== 'agency') {
    return new Response(JSON.stringify({ error: 'Agency plan required' }), { status: 403 })
  }

  // Rate limit: 10 messages/min per user
  const rl = checkRateLimit(getRateLimitKey(req, 'cortex', user.id), RATE_CORTEX)
  if (!rl.allowed) return rateLimitResponse(rl)

  let body: { message?: string; page_context?: string; candidate_context?: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : ''
  if (!message) return new Response(JSON.stringify({ error: 'Message required' }), { status: 400 })

  const pageContext = typeof body.page_context === 'string' ? body.page_context.slice(0, 3000) : ''
  const candidateContext = typeof body.candidate_context === 'string' ? body.candidate_context.slice(0, 2000) : ''

  // Fetch last 20 messages for continuity
  const [{ data: history }, { data: memoryRows }] = await Promise.all([
    supabase.from('cortex_conversations').select('role, content').eq('user_id', user.id).order('created_at', { ascending: true }).limit(20),
    supabase.from('cortex_memory').select('memory_value').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(10),
  ])

  const memoryEntries = (memoryRows ?? []).map((r: { memory_value: string }) => r.memory_value)

  const messages: MessageParam[] = []
  for (const msg of (history ?? [])) {
    messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
  }
  messages.push({ role: 'user', content: message })

  const systemPrompt = buildCortexSystemPrompt(pageContext, candidateContext, memoryEntries)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = ''

      try {
        const messageStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 1000,
          system: systemPrompt,
          messages,
        })

        for await (const chunk of messageStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const token = chunk.delta.text
            fullResponse += token
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
          }
        }

        // Save both messages to conversation history
        const admin = createAdminClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = admin as any
        await db.from('cortex_conversations').insert([
          { user_id: user.id, role: 'user', content: message, page_context: pageContext || null },
          { user_id: user.id, role: 'assistant', content: fullResponse, page_context: null },
        ])

        // Background memory extraction — non-blocking
        extractMemory(user.id, message, db).catch((err: unknown) =>
          console.error('[cortex/chat] memory extraction error:', err)
        )

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
      } catch (err) {
        console.error('[cortex/chat] error:', err)
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ token: "I'm having a technical issue — try again in a moment." })}\n\n`
        ))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
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

/**
 * Lightweight memory extraction — runs after each user message.
 * Uses Claude to check if the message contains facts worth remembering.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractMemory(userId: string, userMessage: string, db: any) {
  // Only attempt extraction on messages > 20 chars (skip short replies)
  if (userMessage.length < 20) return

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Extract any memorable facts from this recruiter's message. Only extract things worth remembering across sessions — client names, industries, roles they work on, pay rate ranges, team size, preferences. Return ONLY a JSON array of {key, value} pairs, or an empty array if nothing worth remembering.

Examples of good extractions:
[{"key":"common_clients","value":"Works with CenterPoint Energy and DTE"},{"key":"target_rates","value":"Typically targets $40-80/hr W2"}]

Message: "${userMessage.slice(0, 1000)}"

Return ONLY valid JSON array:`,
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return

  try {
    const entries = JSON.parse(match[0]) as Array<{ key: string; value: string }>
    if (!Array.isArray(entries) || entries.length === 0) return

    for (const entry of entries.slice(0, 3)) {
      if (!entry.key || !entry.value) continue
      await db.from('cortex_memory').upsert(
        { user_id: userId, memory_key: entry.key, memory_value: entry.value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,memory_key' },
      )
    }
  } catch {
    // Parse failure — skip silently
  }
}
