import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing/landing-page'

export const metadata = {
  title: 'Candid.ai — AI Recruiting Platform for Agency Recruiters',
  description:
    'Stop screening resumes. Start making placements. Candid.ai scores candidates, writes submittals, builds Boolean strings, and tells you who to call first.',
}

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return <LandingPage />
}
