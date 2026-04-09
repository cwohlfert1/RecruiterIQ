import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/types/database'
import type { Database } from '@/types/database'

export type PlanTier = 'free' | 'pro' | 'agency'

export type AIGateResult =
  | { allowed: true;  userId: string; planTier: PlanTier; profile: UserProfile }
  | { allowed: false; reason: 'unauthenticated' | 'limit_reached' | 'plan_required'; planTier?: PlanTier }

/**
 * Server-side gate for all AI feature API routes.
 *
 * Checks:
 *  1. User is authenticated
 *  2. If requiredPlan is set, user has that plan tier
 *  3. Free-tier users haven't exceeded 10 calls/month
 *
 * Also resets ai_calls_this_month if the calendar month has rolled over.
 */
export async function checkAIGate(requiredPlan?: 'pro' | 'agency'): Promise<AIGateResult> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { allowed: false, reason: 'unauthenticated' }

  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Cast to bypass TypeScript generic inference issue with Supabase SSR client
  const profile = profileData as Database['public']['Tables']['user_profiles']['Row'] | null

  if (!profile) return { allowed: false, reason: 'unauthenticated' }

  // Reset counter if calendar month has rolled over
  const lastReset  = new Date(profile.last_reset_at)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  if (lastReset < monthStart) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('user_profiles')
      .update({ ai_calls_this_month: 0, last_reset_at: monthStart.toISOString() })
      .eq('user_id', user.id)
    profile.ai_calls_this_month = 0
  }

  // Plan requirement check
  if (requiredPlan === 'agency' && profile.plan_tier !== 'agency') {
    return { allowed: false, reason: 'plan_required', planTier: profile.plan_tier as PlanTier }
  }
  if (requiredPlan === 'pro' && profile.plan_tier === 'free') {
    return { allowed: false, reason: 'plan_required', planTier: profile.plan_tier as PlanTier }
  }

  // Free tier call limit
  if (profile.plan_tier === 'free' && profile.ai_calls_this_month >= 25) {
    return { allowed: false, reason: 'limit_reached', planTier: 'free' }
  }

  return {
    allowed:   true,
    userId:    user.id,
    planTier:  profile.plan_tier as PlanTier,
    profile:   profile as UserProfile,
  }
}

/**
 * Increment ai_calls_this_month for a user after a successful Claude call.
 * Must only be called after a successful response — failed calls never count.
 */
export async function incrementAICallCount(userId: string): Promise<void> {
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('user_profiles')
    .select('ai_calls_this_month')
    .eq('user_id', userId)
    .single() as { data: { ai_calls_this_month: number } | null }

  await db
    .from('user_profiles')
    .update({ ai_calls_this_month: (data?.ai_calls_this_month ?? 0) + 1 })
    .eq('user_id', userId)
}
