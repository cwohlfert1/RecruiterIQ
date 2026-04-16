import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row']
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

const GRACE_PERIOD_DAYS = 3

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Cast to bypass TypeScript generic inference issue with Supabase SSR client
  const profile = profileData as UserProfileRow | null

  if (!profile) redirect('/login')

  // ── Grace period downgrade check ─────────────────────────────────────
  // If payment has been failing for > 3 days, downgrade to free.
  if (profile.subscription_status === 'grace' && profile.grace_period_start) {
    const graceSince = new Date(profile.grace_period_start)
    const daysPassed = (Date.now() - graceSince.getTime()) / (1000 * 60 * 60 * 24)

    if (daysPassed > GRACE_PERIOD_DAYS) {
      const admin = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('user_profiles')
        .update({
          plan_tier: 'free',
          subscription_status: 'free',
          square_subscription_id: null,
          grace_period_start: null,
          billing_period_end: null,
        })
        .eq('user_id', user.id)

      profile.plan_tier = 'free'
      profile.subscription_status = 'free'
    }
  }

  // ── Cancellation period end check ──────────────────────────────────
  // If billing period has passed, finalize the downgrade to free.
  if (profile.subscription_status === 'cancelling' && profile.billing_period_end) {
    const periodEnd = new Date(profile.billing_period_end)
    if (Date.now() > periodEnd.getTime()) {
      const admin = createAdminClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('user_profiles')
        .update({
          plan_tier: 'free',
          subscription_status: 'free',
          square_subscription_id: null,
          billing_period_end: null,
        })
        .eq('user_id', user.id)

      profile.plan_tier = 'free'
      profile.subscription_status = 'free'
    }
  }

  const showGraceBanner  = profile.subscription_status === 'grace'
  const showProfileNudge = !(profile as typeof profile & { avatar_url?: string | null }).avatar_url
                        && !(profile as typeof profile & { linkedin_id?: string | null }).linkedin_id

  return (
    <DashboardShell
      profile={profile}
      userEmail={user.email ?? ''}
      showGraceBanner={showGraceBanner}
      showProfileNudge={showProfileNudge}
    >
      {children}
    </DashboardShell>
  )
}
