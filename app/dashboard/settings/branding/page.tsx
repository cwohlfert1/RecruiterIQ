import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AgencyBrandingClient } from './branding-client'

export const metadata = { title: 'Agency Branding' }

export default async function AgencyBrandingPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('plan_tier, agency_name, agency_logo_url')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.plan_tier !== 'agency') redirect('/dashboard/settings')

  return (
    <AgencyBrandingClient
      initialAgencyName={profile.agency_name ?? ''}
      initialLogoUrl={profile.agency_logo_url ?? null}
    />
  )
}
