import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TeamClient } from './team-client'
import type { Database } from '@/types/database'

export const metadata = { title: 'Team Management' }

export default async function TeamPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('plan_tier')
    .eq('user_id', user.id)
    .single()

  const profile = profileData as Pick<Database['public']['Tables']['user_profiles']['Row'], 'plan_tier'> | null

  if (!profile) redirect('/login')

  // Non-agency users see locked state
  if (profile.plan_tier !== 'agency') {
    return <TeamLockedState />
  }

  // Fetch team members with their AI call counts
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = admin as any
  const { data: members } = await adminDb
    .from('team_members')
    .select('*')
    .eq('owner_user_id', user.id)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: true }) as { data: Database['public']['Tables']['team_members']['Row'][] | null }

  // Fetch AI calls for active members
  const activeMemberIds = (members ?? [])
    .filter((m) => m.status === 'active' && m.member_user_id)
    .map((m) => m.member_user_id!)

  const callsByUser: Record<string, number> = {}
  if (activeMemberIds.length > 0) {
    const { data: profiles } = await adminDb
      .from('user_profiles')
      .select('user_id, ai_calls_this_month')
      .in('user_id', activeMemberIds) as { data: Pick<Database['public']['Tables']['user_profiles']['Row'], 'user_id' | 'ai_calls_this_month'>[] | null }

    profiles?.forEach((p) => {
      callsByUser[p.user_id] = p.ai_calls_this_month
    })
  }

  return (
    <TeamClient
      ownerEmail={user.email ?? ''}
      members={members ?? []}
      callsByUser={callsByUser}
    />
  )
}

function TeamLockedState() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Team Management</h1>
      <p className="text-slate-400 text-sm mb-8">Invite and manage your recruiting team.</p>

      <div className="glass-card p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white">Team management requires Agency</h2>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          Upgrade to Agency to invite up to 4 team members, view their usage, and manage access.
        </p>
        <a
          href="/dashboard/settings/billing"
          className="inline-flex items-center px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-colors"
        >
          Upgrade to Agency — $99/mo
        </a>
      </div>
    </div>
  )
}
