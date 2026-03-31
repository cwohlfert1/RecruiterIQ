import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { squareClient } from '@/lib/square/client'
import type { Database } from '@/types/database'

type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']

export async function POST() {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('square_subscription_id, subscription_status')
      .eq('user_id', user.id)
      .single()

    const profile = profileData as {
      square_subscription_id: string | null
      subscription_status:    string
    } | null

    if (!profile?.square_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    if (profile.subscription_status === 'cancelling') {
      return NextResponse.json({ error: 'Subscription already canceling' }, { status: 400 })
    }

    // ── Fetch subscription to get billing period end ───────────────────────
    const subRes = await squareClient.subscriptions.get({
      subscriptionId: profile.square_subscription_id,
    })
    const subscription = subRes.subscription

    // billing_period_end: Square returns the charged-through-date on the subscription
    const billingPeriodEnd =
      subscription?.chargedThroughDate
        ? new Date(subscription.chargedThroughDate).toISOString()
        : null

    // ── Cancel at Square (access continues through billing period) ─────────
    await squareClient.subscriptions.cancel({
      subscriptionId: profile.square_subscription_id,
    })

    // ── Update Supabase ───────────────────────────────────────────────────
    const admin = createAdminClient()
    // Note: TypeScript struggles to resolve the update type when the Database
    // generic intersects with the Supabase SSR client in the same scope.
    // The cast is safe — the Update type is validated by the UserProfileUpdate alias above.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('user_profiles') as any)
      .update({
        subscription_status: 'cancelling',
        billing_period_end:  billingPeriodEnd,
      } satisfies UserProfileUpdate)
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
