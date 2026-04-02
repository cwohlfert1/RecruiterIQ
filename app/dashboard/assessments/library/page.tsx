import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TemplateLibrary } from '@/components/assessments/template-library'
import type { UserProfile } from '@/types/database'

export const metadata = { title: 'Template Library' }

export default async function TemplateLibraryPage() {
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

  return <TemplateLibrary />
}
