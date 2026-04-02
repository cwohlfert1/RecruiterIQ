import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { ProjectTabs } from '@/components/projects/project-tabs'
import { ProjectStatusDropdown } from '@/components/projects/project-status-dropdown'
import type { ProjectMemberRole, ProjectStatus, ProjectCandidate } from '@/types/database'

export const metadata = { title: 'Project' }

// ─── Shared candidate row type (server → client) ────────────────

export type CandidateRow = ProjectCandidate & {
  invite_status:      'pending' | 'completed' | null
  trust_score:        number | null
  skill_score:        number | null
  assessment_session_id: string | null
}

const STATUS_BADGE: Record<ProjectStatus, { label: string; className: string }> = {
  active:   { label: 'Active',   className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  on_hold:  { label: 'On Hold',  className: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/20'  },
  filled:   { label: 'Filled',   className: 'bg-blue-500/15    text-blue-400    border-blue-500/20'    },
  archived: { label: 'Archived', className: 'bg-slate-500/15   text-slate-400   border-slate-500/20'   },
}

interface PageProps {
  params: { id: string }
}

export default async function ProjectDetailPage({ params }: PageProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch project + members in parallel with candidates + profile
  const [projectRes, candidatesRes, profileRes] = await Promise.all([
    supabase
      .from('projects')
      .select('*, project_members(id, user_id, role, added_by, added_at)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('project_candidates')
      .select('*')
      .eq('project_id', params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_profiles')
      .select('role, plan_tier')
      .eq('user_id', user.id)
      .single(),
  ])

  if (projectRes.error || !projectRes.data) notFound()

  const project    = projectRes.data
  const rawCands: ProjectCandidate[] = candidatesRes.data ?? []
  const isManager  = profileRes.data?.role === 'manager'
  const planTier: 'free' | 'pro' | 'agency' = profileRes.data?.plan_tier ?? 'free'

  // Determine caller's role
  const rawMembers: Array<{ id: string; user_id: string; role: string; added_at: string | null }> =
    project.project_members ?? []
  const callerMember = rawMembers.find((m) => m.user_id === user.id)
  const callerRole: ProjectMemberRole | 'owner' | null =
    (callerMember?.role as ProjectMemberRole) ?? (project.owner_id === user.id ? 'owner' : null)

  const isOwner = project.owner_id === user.id || callerRole === 'owner'
  const canEdit = isOwner || callerRole === 'collaborator'

  // Resolve member emails via admin client (for Settings tab)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Resolve emails for owner + all non-owner members
  const memberUserIds = rawMembers.map(m => m.user_id)
  const allUserIds    = Array.from(new Set([project.owner_id, ...memberUserIds]))
  const emailMap: Record<string, string> = {}

  await Promise.all(allUserIds.map(async uid => {
    if (uid === user.id && user.email) {
      emailMap[uid] = user.email
    } else {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data?.user?.email) emailMap[uid] = data.user.email
    }
  }))

  // Owner always appears first as a synthetic member entry (not in project_members table)
  const ownerEntry = {
    id:       `owner-${project.owner_id}`,
    user_id:  project.owner_id,
    role:     'owner',
    email:    emailMap[project.owner_id] ?? null,
    added_at: project.created_at as string | null,
  }

  const members = [
    ownerEntry,
    ...rawMembers.map(m => ({
      id:       m.id,
      user_id:  m.user_id,
      role:     m.role,
      email:    emailMap[m.user_id] ?? null,
      added_at: m.added_at,
    })),
  ]

  // Fetch assessment invite + session data for candidates that have invite_id
  const inviteIds = rawCands
    .map((c: ProjectCandidate) => c.assessment_invite_id)
    .filter(Boolean) as string[]

  let inviteMap: Record<string, { status: 'pending' | 'completed'; trust_score: number | null; skill_score: number | null; session_id: string | null }> = {}

  if (inviteIds.length > 0) {
    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('id, invite_id, trust_score, skill_score, status')
      .in('invite_id', inviteIds)

    for (const s of sessions ?? []) {
      inviteMap[s.invite_id] = {
        status:      s.status === 'completed' ? 'completed' : 'pending',
        trust_score: s.trust_score ?? null,
        skill_score: s.skill_score ?? null,
        session_id:  s.status === 'completed' ? s.id : null,
      }
    }

    for (const id of inviteIds) {
      if (!inviteMap[id]) {
        inviteMap[id] = { status: 'pending', trust_score: null, skill_score: null, session_id: null }
      }
    }
  }

  const candidates: CandidateRow[] = rawCands.map((c: ProjectCandidate) => ({
    ...c,
    invite_status:         c.assessment_invite_id ? (inviteMap[c.assessment_invite_id]?.status ?? 'pending') : null,
    trust_score:           c.assessment_invite_id ? (inviteMap[c.assessment_invite_id]?.trust_score ?? null) : null,
    skill_score:           c.assessment_invite_id ? (inviteMap[c.assessment_invite_id]?.skill_score ?? null) : null,
    assessment_session_id: c.assessment_invite_id ? (inviteMap[c.assessment_invite_id]?.session_id ?? null) : null,
  }))

  const badge       = STATUS_BADGE[project.status as ProjectStatus] ?? STATUS_BADGE.active
  const memberCount = members.length
  const shownCount  = Math.min(memberCount, 3)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        My Projects
      </Link>

      {/* Header card */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-white leading-tight">
                {project.title}
              </h1>
              {canEdit ? (
                <ProjectStatusDropdown
                  projectId={project.id}
                  currentStatus={project.status as ProjectStatus}
                />
              ) : (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
                  {badge.label}
                </span>
              )}
            </div>

            <p className="text-sm text-slate-400 mb-4">{project.client_name}</p>

            <div className="flex items-center gap-5 text-xs text-slate-500 flex-wrap">
              {/* Member avatars */}
              <span className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {Array.from({ length: shownCount }).map((_, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full bg-gradient-brand border-2 border-[#1A1D2E] flex items-center justify-center text-[9px] font-bold text-white"
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                  {memberCount > 3 && (
                    <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-[#1A1D2E] flex items-center justify-center text-[9px] font-semibold text-slate-300">
                      +{memberCount - 3}
                    </div>
                  )}
                </div>
                <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
              </span>

              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
              </span>

              {callerRole && callerRole !== 'owner' && (
                <span className="text-indigo-400 font-medium capitalize">{callerRole}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card rounded-2xl p-6">
        <ProjectTabs
          project={project}
          candidates={candidates}
          userId={user.id}
          canEdit={canEdit}
          isManager={isManager}
          planTier={planTier}
          members={members}
        />
      </div>
    </div>
  )
}
