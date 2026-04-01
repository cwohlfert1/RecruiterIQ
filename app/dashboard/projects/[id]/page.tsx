import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Calendar } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { ProjectTabs } from '@/components/projects/project-tabs'
import { ProjectStatusDropdown } from '@/components/projects/project-status-dropdown'
import type { ProjectMemberRole, ProjectStatus } from '@/types/database'

export const metadata = { title: 'Project' }

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

  const { data: project, error } = await supabase
    .from('projects')
    .select('*, project_members(id, user_id, role, added_by, added_at)')
    .eq('id', params.id)
    .single()

  if (error || !project) notFound()

  // Determine caller's role
  const members: Array<{ id: string; user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find(m => m.user_id === user.id)
  const callerRole: ProjectMemberRole | 'owner' | null =
    (callerMember?.role as ProjectMemberRole) ?? (project.owner_id === user.id ? 'owner' : null)

  const isOwner = project.owner_id === user.id || callerRole === 'owner'
  const canEdit = isOwner || callerRole === 'collaborator'

  const badge = STATUS_BADGE[project.status as ProjectStatus] ?? STATUS_BADGE.active

  // Member avatar stack (max 3 shown)
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

      {/* Header */}
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
                <span>
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                </span>
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

          {/* Action buttons */}
          {canEdit && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={`/dashboard/projects/${project.id}/edit`}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 border border-white/10 hover:border-white/20 hover:text-white transition-colors"
              >
                Edit
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card rounded-2xl p-6">
        <ProjectTabs />
      </div>
    </div>
  )
}
