import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssessmentBuilder } from '@/components/assessments/assessment-builder'
import type { UserProfile } from '@/types/database'

export const metadata = { title: 'Create Assessment' }

export default async function CreateAssessmentPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')
  const safeProfile = profile as UserProfile

  if (safeProfile.role !== 'manager') redirect('/dashboard/assessments')

  return <AssessmentBuilder profile={safeProfile} />
}
