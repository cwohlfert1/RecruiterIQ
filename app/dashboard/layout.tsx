import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database'

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row']
import { Sidebar } from '@/components/dashboard/sidebar'
import { TopBar } from '@/components/dashboard/top-bar'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { GracePeriodBanner } from '@/components/dashboard/grace-period-banner'

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

  const showGraceBanner = profile.subscription_status === 'grace'

  return (
    <div className="flex h-screen bg-[#0F1117]">
      {/* Sidebar — desktop only, always full height */}
      <div className="hidden md:flex h-full flex-shrink-0">
        <Sidebar profile={profile} userEmail={user.email ?? ''} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar profile={profile} />
        {showGraceBanner && <GracePeriodBanner />}
        <main className="flex-1 p-6 pb-24 md:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
