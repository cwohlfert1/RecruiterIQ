import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { checkRateLimit, getRateLimitKey, rateLimitResponse, RATE_PUBLIC } from '@/lib/security/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: 30 req/min per IP (public endpoint)
  const rl = checkRateLimit(getRateLimitKey(req, 'sales-dropoff'), RATE_PUBLIC)
  if (!rl.allowed) return rateLimitResponse(rl)

  let body: {
    session_id?: unknown
    event?: unknown
    last_user_message?: unknown
    turn_count?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : null
  const event = body.event === 'inactivity' ? 'inactivity' : 'drop_off'
  const lastUserMessage =
    typeof body.last_user_message === 'string' ? body.last_user_message.slice(0, 500) : null
  const turnCount = typeof body.turn_count === 'number' ? body.turn_count : 0

  if (!sessionId) {
    return Response.json({ error: 'session_id required' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  try {
    // Fetch current lead state
    const { data: lead } = await db
      .from('sales_leads')
      .select('name, email, company, team_size, qualified, conversation_json')
      .eq('session_id', sessionId)
      .single()

    // If already qualified, don't send a drop-off email
    if (lead?.qualified) {
      return Response.json({ ok: true })
    }

    // Only send if at least 1 message was exchanged
    if (turnCount === 0) {
      return Response.json({ ok: true })
    }

    const updates: Record<string, unknown> = {
      drop_off_reason: lastUserMessage,
    }
    if (event === 'inactivity') {
      updates.inactivity_close = true
      updates.drop_off = true
    } else {
      updates.drop_off = true
    }

    await db.from('sales_leads').update(updates).eq('session_id', sessionId)

    // Send drop-off notification (best-effort)
    await sendDropOffEmail({
      event,
      name: lead?.name ?? null,
      email: lead?.email ?? null,
      company: lead?.company ?? null,
      teamSize: lead?.team_size ?? null,
      lastUserMessage,
      turnCount,
    }).catch((err) =>
      console.error('[sales-chat/drop-off] Resend error:', err),
    )

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[sales-chat/drop-off] error:', err)
    return Response.json({ ok: true }) // Never surface errors to client
  }
}

async function sendDropOffEmail(params: {
  event: 'drop_off' | 'inactivity'
  name: string | null
  email: string | null
  company: string | null
  teamSize: string | null
  lastUserMessage: string | null
  turnCount: number
}) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? '')

  const label = params.name ?? params.company ?? 'Unknown'
  const subjectPrefix =
    params.event === 'inactivity' ? 'Inactivity close' : 'Drop-off'

  await resend.emails.send({
    from: 'Candid.ai <hello@candidai.app>',
    to: 'collin@candidai.app',
    subject: `${subjectPrefix} — ${label}`,
    html: `
      <h2>${params.event === 'inactivity' ? 'Inactivity Close' : 'Chat Drop-off'}</h2>
      <p>A prospect left the chat without fully qualifying.</p>
      <table cellpadding="8" style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td><strong>Name</strong></td><td>${params.name ?? '—'}</td></tr>
        <tr><td><strong>Email</strong></td><td>${params.email ?? '—'}</td></tr>
        <tr><td><strong>Company</strong></td><td>${params.company ?? '—'}</td></tr>
        <tr><td><strong>Team Size</strong></td><td>${params.teamSize ?? '—'}</td></tr>
        <tr><td><strong>Turns</strong></td><td>${params.turnCount}</td></tr>
        <tr><td><strong>Last message</strong></td><td>${params.lastUserMessage ?? '—'}</td></tr>
        <tr><td><strong>Reason</strong></td><td>${params.event === 'inactivity' ? 'Closed by 15-minute inactivity timeout' : 'Closed widget manually'}</td></tr>
      </table>
    `,
  })
}
