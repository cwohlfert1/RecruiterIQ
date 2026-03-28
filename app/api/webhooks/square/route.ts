import { NextRequest, NextResponse } from 'next/server'
import { WebhooksHelper } from 'square'
import { createAdminClient } from '@/lib/supabase/admin'

// Square sends webhooks to the full public URL — must match exactly
const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/square`

export async function POST(req: NextRequest) {
  // ── 1. Read raw body (signature verification requires the raw string) ───
  const rawBody = await req.text()
  const signature = req.headers.get('x-square-hmacsha256-signature') ?? ''

  // ── 2. Verify signature ───────────────────────────────────────────────
  const isValid = WebhooksHelper.isValidWebhookEventSignature(
    rawBody,
    signature,
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!,
    WEBHOOK_URL
  )

  if (!isValid) {
    console.warn('[webhook/square] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── 3. Return 200 immediately, process async ──────────────────────────
  processWebhookAsync(rawBody).catch((err) =>
    console.error('[webhook/square] Async processing error:', err)
  )

  return NextResponse.json({ received: true })
}

async function processWebhookAsync(rawBody: string) {
  const admin = createAdminClient()
  let event: { event_id: string; type: string; data?: unknown }

  try {
    event = JSON.parse(rawBody)
  } catch {
    console.error('[webhook/square] Failed to parse body')
    return
  }

  const eventId = event.event_id
  const eventType = event.type

  // ── 4. Idempotency: insert event; skip if already processed ──────────
  const { error: insertError } = await admin
    .from('square_webhook_events')
    .insert({
      event_id: eventId,
      event_type: eventType,
      payload: event as Record<string, unknown>,
    })

  // unique violation = already processed
  if (insertError?.code === '23505') {
    console.log(`[webhook/square] Duplicate event ${eventId} — skipping`)
    return
  }
  if (insertError) {
    console.error('[webhook/square] Insert error:', insertError)
    return
  }

  // ── 5. Handle events ──────────────────────────────────────────────────
  try {
    switch (eventType) {
      case 'subscription.created':
      case 'subscription.updated':
        await handleSubscriptionUpdate(admin, event)
        break
      case 'invoice.payment_made':
        await handlePaymentMade(admin, event)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(admin, event)
        break
      case 'subscription.canceled':
        await handleSubscriptionCanceled(admin, event)
        break
      default:
        // Unhandled event type — log and move on
        console.log(`[webhook/square] Unhandled event type: ${eventType}`)
    }

    // Mark processed
    await admin
      .from('square_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[webhook/square] Processing error for ${eventId}:`, msg)
    await admin
      .from('square_webhook_events')
      .update({ error: msg })
      .eq('event_id', eventId)
  }
}

// ── Event handlers ──────────────────────────────────────────────────────────

async function handleSubscriptionUpdate(
  admin: ReturnType<typeof createAdminClient>,
  event: Record<string, unknown>
) {
  const sub = (event as { data?: { object?: { subscription?: Record<string, unknown> } } })
    ?.data?.object?.subscription
  if (!sub?.id) return

  const subscriptionId = sub.id as string
  const status = (sub.status as string | undefined)?.toLowerCase()

  // Map Square status → our status
  const statusMap: Record<string, string> = {
    active: 'active',
    canceled: 'cancelled',
    deactivated: 'cancelled',
    pending: 'active',
    paused: 'grace',
  }

  const newStatus = status ? (statusMap[status] ?? 'active') : 'active'

  await admin
    .from('user_profiles')
    .update({ subscription_status: newStatus })
    .eq('square_subscription_id', subscriptionId)
}

async function handlePaymentMade(
  admin: ReturnType<typeof createAdminClient>,
  event: Record<string, unknown>
) {
  const invoice = (event as { data?: { object?: { invoice?: Record<string, unknown> } } })
    ?.data?.object?.invoice
  const subscriptionId = invoice?.subscription_id as string | undefined
  if (!subscriptionId) return

  await admin
    .from('user_profiles')
    .update({
      subscription_status: 'active',
      grace_period_start: null,
    })
    .eq('square_subscription_id', subscriptionId)
}

async function handlePaymentFailed(
  admin: ReturnType<typeof createAdminClient>,
  event: Record<string, unknown>
) {
  const invoice = (event as { data?: { object?: { invoice?: Record<string, unknown> } } })
    ?.data?.object?.invoice
  const subscriptionId = invoice?.subscription_id as string | undefined
  if (!subscriptionId) return

  await admin
    .from('user_profiles')
    .update({
      subscription_status: 'grace',
      grace_period_start: new Date().toISOString(),
    })
    .eq('square_subscription_id', subscriptionId)
}

async function handleSubscriptionCanceled(
  admin: ReturnType<typeof createAdminClient>,
  event: Record<string, unknown>
) {
  const sub = (event as { data?: { object?: { subscription?: Record<string, unknown> } } })
    ?.data?.object?.subscription
  if (!sub?.id) return

  const subscriptionId = sub.id as string

  // Downgrade to free — billing period end has passed
  await admin
    .from('user_profiles')
    .update({
      plan_tier: 'free',
      subscription_status: 'free',
      square_subscription_id: null,
      grace_period_start: null,
      billing_period_end: null,
    })
    .eq('square_subscription_id', subscriptionId)
}
