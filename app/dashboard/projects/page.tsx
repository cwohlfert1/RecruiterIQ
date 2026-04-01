import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PlusCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ProjectsClient } from '@/components/projects/projects-client'
import type { ProjectListItem, ProjectMemberRole } from '@/types/database'

export const metadata = { title: 'My Projects' }

export default async function ProjectsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all projects visible to this user (RLS handles filtering)
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*, project_members(user_id, role)')
    .order('updated_at', { ascending: false })

  if (projectsError) {
    return (
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-red-400">Failed to load projects.</p>
      </div>
    )
  }

  const projectList = projects ?? []

  if (projectList.length === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <Header />
        <div className="glass-card rounded-2xl p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mb-4">
            <PlusCircle className="w-7 h-7 text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">No projects yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            Create your first project to start organising your pipeline, track candidates, and collaborate with your team.
          </p>
          <Link
            href="/dashboard/projects/create"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
          >
            Create a Project
          </Link>
        </div>
      </div>
    )
  }

  // Fetch candidate counts + top CQI, and last activity per project
  const projectIds: string[] = projectList.map((p: { id: string }) => p.id)

  const [candidatesRes, activitiesRes] = await Promise.all([
    supabase
      .from('project_candidates')
      .select('project_id, cqi_score')
      .in('project_id', projectIds)
      .is('deleted_at', null),
    supabase
      .from('project_activity')
      .select('project_id, created_at')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false }),
  ])

  // Aggregate candidate stats
  const candidateMap: Record<string, { count: number; topCQI: number | null }> = {}
  for (const c of (candidatesRes.data ?? [])) {
    if (!candidateMap[c.project_id]) candidateMap[c.project_id] = { count: 0, topCQI: null }
    candidateMap[c.project_id].count++
    if (c.cqi_score !== null) {
      const cur = candidateMap[c.project_id].topCQI
      if (cur === null || c.cqi_score > cur) candidateMap[c.project_id].topCQI = c.cqi_score
    }
  }

  // First activity entry per project = latest (sorted desc)
  const activityMap: Record<string, string> = {}
  for (const a of (activitiesRes.data ?? [])) {
    if (!activityMap[a.project_id]) activityMap[a.project_id] = a.created_at
  }

  const enriched: ProjectListItem[] = projectList.map((p: {
    id: string
    owner_id: string
    title: string
    client_name: string
    jd_text: string | null
    status: string
    created_at: string
    updated_at: string
    project_members: Array<{ user_id: string; role: string }>
  }) => ({
    id:               p.id,
    owner_id:         p.owner_id,
    title:            p.title,
    client_name:      p.client_name,
    jd_text:          p.jd_text,
    status:           p.status as ProjectListItem['status'],
    created_at:       p.created_at,
    updated_at:       p.updated_at,
    candidate_count:  candidateMap[p.id]?.count  ?? 0,
    top_cqi:          candidateMap[p.id]?.topCQI ?? null,
    last_activity_at: activityMap[p.id]           ?? null,
    members:          (p.project_members ?? []).map(m => ({
      user_id: m.user_id,
      role:    m.role as ProjectMemberRole,
    })),
    is_owner: p.owner_id === user.id,
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Header />
      <ProjectsClient projects={enriched} userId={user.id} />
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold gradient-text mb-1">
          What are you working on today?
        </h1>
        <p className="text-sm text-slate-400">
          Manage your open roles, track candidates, and collaborate with your team.
        </p>
      </div>
      <Link
        href="/dashboard/projects/create"
        className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-brand hover-glow transition-all duration-150"
      >
        <PlusCircle className="w-4 h-4" />
        <span>Create New Project</span>
      </Link>
    </div>
  )
}
