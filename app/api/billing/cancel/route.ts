import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { squareClient } from '@/lib/square/client'

export async function POST() {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('square_subscription_id, subscription_status')
      .eq('user_id', user.id)
      .single()

    if (!profile?.square_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    if (profile.subscription_status === 'cancelling') {
      return NextResponse.json({ error: 'Subscription already canceling' }, { status: 400 })
    }

    // ── Fetch subscription to get billing period end ───────────────────────
    const subRes = await squareClient.subscriptions.retrieve({
      subscriptionId: profile.square_subscription_id,
    })
    const subscription = subRes.subscription

    // billing_period_end: Square returns the paid-through-date on the subscription
    const billingPeriodEnd =
      subscription?.paidUntilDate
        ? new Date(subscription.paidUntilDate).toISOString()
        : null

    // ── Cancel at Square (access continues through billing period) ─────────
    await squareClient.subscriptions.cancel({
      subscriptionId: profile.square_subscription_id,
    })

    // ── Update Supabase ───────────────────────────────────────────────────
    const admin = createAdminClient()
    await admin
      .from('user_profiles')
      .update({
        subscription_status: 'cancelling',
        billing_period_end: billingPeriodEnd,
      })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      billingPeriodEnd,
    })
  } catch (err: unknown) {
    console.error('[billing/cancel]', err)
    return NextResponse.json({ error: 'Cancellation failed' }, { status: 500 })
  }
}
