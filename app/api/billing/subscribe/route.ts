import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { squareClient } from '@/lib/square/client'
import { PLAN_CONFIG, type PaidPlanKey } from '@/lib/square/plans'

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan_tier, square_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // ── Input validation ──────────────────────────────────────────────────
    const body = await req.json()
    const { token, plan } = body as { token: string; plan: PaidPlanKey }

    if (!token || !plan || !PLAN_CONFIG[plan]) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const planConfig = PLAN_CONFIG[plan]
    if (!planConfig.planVariationId) {
      return NextResponse.json(
        { error: 'Plan not configured. Run the setup script first.' },
        { status: 500 }
      )
    }

    // ── Create or reuse Square customer ───────────────────────────────────
    let customerId = profile.square_customer_id

    if (!customerId) {
      const customerRes = await squareClient.customers.create({
        idempotencyKey: randomUUID(),
        emailAddress: user.email,
        referenceId: user.id,
      })
      customerId = customerRes.customer?.id ?? null
      if (!customerId) {
        throw new Error('Failed to create Square customer')
      }
    }

    // ── Save card on file using payment token ─────────────────────────────
    const cardRes = await squareClient.cards.create({
      idempotencyKey: randomUUID(),
      sourceId: token,
      card: {
        customerId,
      },
    })
    const cardId = cardRes.card?.id
    if (!cardId) throw new Error('Failed to save card')

    // ── Create subscription ───────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const subRes = await squareClient.subscriptions.create({
      idempotencyKey: randomUUID(),
      locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!,
      planVariationId: planConfig.planVariationId,
      customerId,
      cardId,
      startDate: today,
    })

    const subscription = subRes.subscription
    if (!subscription?.id) throw new Error('Failed to create subscription')

    // ── Update Supabase ───────────────────────────────────────────────────
    const admin = createAdminClient()
    await admin
      .from('user_profiles')
      .update({
        plan_tier: plan,
        subscription_status: 'active',
        square_customer_id: customerId,
        square_subscription_id: subscription.id,
        grace_period_start: null,
      })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[billing/subscribe]', err)
    const message =
      err instanceof Error ? err.message : 'Subscription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
