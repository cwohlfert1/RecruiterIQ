import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileSearch, FileText, Search, Trophy, Sparkles, ClipboardList, FolderOpen, PlusCircle, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/dashboard/stat-card'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { UsageMeter } from '@/components/dashboard/usage-meter'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { UpgradeBanner } from '@/components/dashboard/upgrade-banner'
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist'
import type { UserProfile, ActivityLog, Project } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'

export const metadata = { title: 'Dashboard' }

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:   { label: 'Active',   className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  on_hold:  { label: 'On Hold',  className: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/20'  },
  filled:   { label: 'Filled',   className: 'bg-blue-500/15    text-blue-400    border-blue-500/20'    },
  archived: { label: 'Archived', className: 'bg-slate-500/15   text-slate-400   border-slate-500/20'   },
}

export default async function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const safeProfile = profile as UserProfile
  const isManager   = safeProfile.role === 'manager'

  const [
    resumeCountRes,
    summaryCountRes,
    booleanCountRes,
    rankingCountRes,
    activityRes,
    assessmentInviteRes,
    activeProjectCountRes,
    recentProjectsRes,
  ] = await Promise.all([
    supabase.from('resume_scores').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('client_summaries').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('boolean_searches').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('stack_rankings').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('activity_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    isManager
      ? supabase.from('assessment_invites').select('id', { count: 'exact', head: true }).eq('created_by', user.id)
      : Promise.resolve({ count: 0 }),
    // Active project count (RLS returns only owned + member projects)
    supabase.from('projects').select('id', { count: 'exact', head: true }).in('status', ['active', 'on_hold']),
    // Recent 3 active projects for widget
    supabase
      .from('projects')
      .select('id, title, client_name, status, updated_at, created_at')
      .in('status', ['active', 'on_hold'])
      .order('updated_at', { ascending: false })
      .limit(3),
  ])

  const stats = {
    resumes:        resumeCountRes.count     ?? 0,
    summaries:      summaryCountRes.count    ?? 0,
    booleans:       booleanCountRes.count    ?? 0,
    rankings:       rankingCountRes.count    ?? 0,
    assessments:    assessmentInviteRes.count ?? 0,
    activeProjects: activeProjectCountRes.count ?? 0,
  }
  const activities      = (activityRes.data ?? []) as ActivityLog[]
  const recentProjects  = (recentProjectsRes.data ?? []) as Project[]

  // Stat card count: base 5 tools, +1 if manager (assessments), always +1 for projects
  const statColCount = isManager ? 6 : 5

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {safeProfile.plan_tier === 'free' && <UpgradeBanner />}

      {/* Onboarding — shown only when user has no activity and no projects yet */}
      {stats.resumes === 0 && stats.activeProjects === 0 && (
        <section className="glass-card rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-7 h-7 text-indigo-400" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-base font-semibold text-white mb-1">
              Welcome to Candid.ai — You have 25 free AI screenings. Let&apos;s use them.
            </h3>
            <p className="text-sm text-slate-400">
              Create a project, add candidates, and let Candid.ai tell you who to call first.
            </p>
          </div>
          <Link
            href="/dashboard/projects/create"
            className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150 whitespace-nowrap"
          >
            Create Your First Project →
          </Link>
        </section>
      )}

      {/* Onboarding checklist */}
      <OnboardingChecklist
        aiCallsUsed={safeProfile.ai_calls_this_month}
        hasProjects={stats.activeProjects > 0}
        hasScoredCandidate={stats.resumes > 0}
        hasBooleanSearch={stats.booleans > 0}
        hasSummary={stats.summaries > 0}
      />

      {/* Stat cards */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
          All time
        </h2>
        <div className={`grid gap-4 grid-cols-2 lg:grid-cols-${statColCount}`}>
          <StatCard label="Resumes Scored"   value={stats.resumes}         icon={<FileSearch   className="w-5 h-5" />} color="indigo"  delay={0}   />
          <StatCard label="Summaries"        value={stats.summaries}       icon={<FileText     className="w-5 h-5" />} color="violet"  delay={60}  />
          <StatCard label="Boolean Strings"  value={stats.booleans}        icon={<Search       className="w-5 h-5" />} color="green"   delay={120} />
          <StatCard label="Stack Rankings"   value={stats.rankings}        icon={<Trophy       className="w-5 h-5" />} color="yellow"  delay={180} />
          <StatCard label="Active Projects"  value={stats.activeProjects}  icon={<FolderOpen   className="w-5 h-5" />} color="indigo"  delay={240} />
          {isManager && (
            <StatCard label="Assessments Sent" value={stats.assessments}  icon={<ClipboardList className="w-5 h-5" />} color="indigo" delay={300} />
          )}
        </div>
      </section>

      {/* Recent Projects widget */}
      {recentProjects.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Recent projects
            </h2>
            <Link
              href="/dashboard/projects"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {recentProjects.map((project) => {
              const badge = STATUS_BADGE[project.status] ?? STATUS_BADGE.active
              return (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="glass-card rounded-2xl p-4 hover:border-white/15 transition-all duration-150 group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {project.title}
                    </p>
                    <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3 line-clamp-1">{project.client_name}</p>
                  <p className="text-[11px] text-slate-500">
                    Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                  </p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Quick actions
          </h2>
          <QuickActions profile={safeProfile} />
        </section>

        <div className="lg:col-span-2 space-y-6">
          <section className="glass-card rounded-2xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Usage
            </h2>
            <UsageMeter profile={safeProfile} />
          </section>

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
