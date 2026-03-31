import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing/landing-page'

export const metadata = {
  title: 'RecruiterIQ — AI Tools Built for Recruiters',
  description:
    'Score resumes, write client summaries, build Boolean strings, and rank your shortlist. Faster than manual screening, built for desks that move fast.',
}

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return <LandingPage />
}
