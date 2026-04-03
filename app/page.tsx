import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing/landing-page'

export const metadata = {
  title: 'Candid.ai — AI Recruiting Platform',
  description:
    'The AI recruiting platform agencies trust. Score resumes, manage pipelines, rank candidates, and verify skills — all in one place.',
}

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return <LandingPage />
}
