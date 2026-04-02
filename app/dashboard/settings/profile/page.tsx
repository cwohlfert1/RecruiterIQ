import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from './profile-client'

export const metadata = { title: 'My Profile' }

export default async function ProfilePage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('avatar_url, display_name, job_title, linkedin_url, linkedin_id, linkedin_connected_at, phone')
    .eq('user_id', user.id)
    .single()

  return (
    <ProfileClient
      userId={user.id}
      email={user.email ?? ''}
      profile={profile ?? {
        avatar_url:            null,
        display_name:          null,
        job_title:             null,
        linkedin_url:          null,
        linkedin_id:           null,
        linkedin_connected_at: null,
        phone:                 null,
      }}
    />
  )
}
