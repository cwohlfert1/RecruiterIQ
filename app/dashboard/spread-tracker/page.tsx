import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { SpreadTrackerClient } from '@/components/spread-tracker/spread-tracker-client'

export const metadata = { title: 'Spread Tracker' }

export default async function SpreadTrackerPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('plan_tier, role')
    .eq('user_id', user.id)
    .single()

  const profile = profileData as Database['public']['Tables']['user_profiles']['Row'] | null
  if (!profile) redirect('/login')

  const planTier = (profile.plan_tier ?? 'free') as string
  const isAgencyOwner = planTier === 'agency'

  return (
    <SpreadTrackerClient
      planTier={planTier}
      isAgencyOwner={isAgencyOwner}
    />
  )
}
