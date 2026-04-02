import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CreditCard, Users, Building2, UserCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getPlanLabel } from '@/lib/utils'
import type { UserProfile } from '@/types/database'
import { UserAvatar } from '@/components/ui/user-avatar'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profileData) redirect('/login')
  const profile = profileData as UserProfile

  const sections = [
    {
      href:        '/dashboard/settings/profile',
      icon:        UserCircle2,
      title:       'My Profile',
      description: 'Connect LinkedIn to sync your photo and title. Visible on notes, activity, and team views.',
    },
    {
      href:        '/dashboard/settings/billing',
      icon:        CreditCard,
      title:       'Billing & Plan',
      description: `You're on the ${getPlanLabel(profile.plan_tier)} plan. Manage your subscription and payment details.`,
    },
    {
      href:        '/dashboard/settings/team',
      icon:        Users,
      title:       'Team',
      description: 'Invite team members, manage roles, and collaborate on projects.',
    },
    ...(profile.plan_tier === 'agency' ? [{
      href:        '/dashboard/settings/branding',
      icon:        Building2,
      title:       'Agency Branding',
      description: 'Upload your agency logo and name to white-label the sidebar for your team.',
    }] : []),
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your account, billing, and team</p>
      </div>

      {/* Profile card */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <UserAvatar
            userId={user.id}
            avatarUrl={(profile as UserProfile & { avatar_url?: string | null }).avatar_url ?? null}
            displayName={(profile as UserProfile & { display_name?: string | null }).display_name ?? null}
            email={user.email}
            size={48}
          />
          <div>
            <p className="text-sm font-semibold text-white">
              {(profile as UserProfile & { display_name?: string | null }).display_name ?? user.email}
            </p>
            {(profile as UserProfile & { job_title?: string | null }).job_title && (
              <p className="text-xs text-slate-400 mt-0.5">
                {(profile as UserProfile & { job_title?: string | null }).job_title}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-0.5 capitalize">
              {profile.role} &middot; {getPlanLabel(profile.plan_tier)} plan
            </p>
          </div>
        </div>
      </div>

      {/* Section cards */}
      <div className="space-y-3">
        {sections.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 glass-card rounded-2xl p-6 hover:bg-white/5 hover:border-white/15 transition-all duration-150"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                {title}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
