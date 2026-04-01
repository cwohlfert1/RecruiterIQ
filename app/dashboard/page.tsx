import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileSearch, FileText, Search, Trophy, Sparkles, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/dashboard/stat-card'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { UsageMeter } from '@/components/dashboard/usage-meter'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { UpgradeBanner } from '@/components/dashboard/upgrade-banner'
import type { UserProfile, ActivityLog } from '@/types/database'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile first — needed for plan-gating logic
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const safeProfile = profile as UserProfile

  const isManager = safeProfile.role === 'manager'

  // Remaining queries in parallel (all-time counts)
  const [resumeCountRes, summaryCountRes, booleanCountRes, rankingCountRes, activityRes, assessmentInviteRes] =
    await Promise.all([
      supabase.from('resume_scores').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase.from('client_summaries').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase.from('boolean_searches').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase.from('stack_rankings').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase.from('activity_log').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      isManager
        ? supabase.from('assessment_invites').select('id', { count: 'exact', head: true })
            .eq('created_by', user.id)
        : Promise.resolve({ count: 0, data: null, error: null }),
    ])

  const stats = {
    resumes:     resumeCountRes.count     ?? 0,
    summaries:   summaryCountRes.count    ?? 0,
    booleans:    booleanCountRes.count    ?? 0,
    rankings:    rankingCountRes.count    ?? 0,
    assessments: assessmentInviteRes.count ?? 0,
  }
  const activities = (activityRes.data ?? []) as ActivityLog[]

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Upgrade banner — client component, checks localStorage */}
      {safeProfile.plan_tier === 'free' && <UpgradeBanner />}

      {/* Stat cards */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
          All time
        </h2>
        <div className={`grid gap-4 ${isManager ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
          <StatCard
            label="Resumes Scored"
            value={stats.resumes}
            icon={<FileSearch className="w-5 h-5" />}
            color="indigo"
            delay={0}
          />
          <StatCard
            label="Summaries"
            value={stats.summaries}
            icon={<FileText className="w-5 h-5" />}
            color="violet"
            delay={80}
          />
          <StatCard
            label="Boolean Strings"
            value={stats.booleans}
            icon={<Search className="w-5 h-5" />}
            color="green"
            delay={160}
          />
          <StatCard
            label="Stack Rankings"
            value={stats.rankings}
            icon={<Trophy className="w-5 h-5" />}
            color="yellow"
            delay={240}
          />
          {isManager && (
            <StatCard
              label="Assessments Sent"
              value={stats.assessments}
              icon={<ClipboardList className="w-5 h-5" />}
              color="indigo"
              delay={320}
            />
          )}
        </div>
      </section>

      {/* Empty state — new users with no data yet */}
      {stats.resumes === 0 && stats.summaries === 0 && stats.booleans === 0 && stats.rankings === 0 && (
        <section className="glass-card rounded-2xl p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Welcome to RecruiterIQ</h3>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            Your AI recruiting toolkit is ready. Score resumes, generate client briefs, build Boolean strings, and rank candidates.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/dashboard/scorer"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
            >
              Score a Resume
            </Link>
            <Link
              href="/dashboard/boolean"
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
            >
              Build Boolean String
            </Link>
          </div>
        </section>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Quick actions — 3 cols */}
        <section className="lg:col-span-3 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Quick actions
          </h2>
          <QuickActions profile={safeProfile} />
        </section>

        {/* Right column — 2 cols */}
        <div className="lg:col-span-2 space-y-6">

          {/* Usage meter */}
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Usage
            </h2>
            <UsageMeter profile={safeProfile} />
          </section>

          {/* Recent activity */}
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Recent activity
            </h2>
            <ActivityFeed activities={activities} />
          </section>

        </div>
      </div>
    </div>
  )
}
