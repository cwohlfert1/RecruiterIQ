import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ProjectListItem } from '@/types/database'

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Fetch all projects visible to this user (RLS handles owner + member filtering)
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*, project_members(user_id, role)')
    .order('updated_at', { ascending: false })

  if (projectsError) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }

  if (!projects || projects.length === 0) {
    return NextResponse.json({ projects: [] })
  }

  const projectIds: string[] = projects.map((p: { id: string }) => p.id)

  // Candidate counts + top CQI in one query
  const { data: candidates } = await supabase
    .from('project_candidates')
    .select('project_id, cqi_score')
    .in('project_id', projectIds)
    .is('deleted_at', null)

  // Last activity per project
  const { data: activities } = await supabase
    .from('project_activity')
    .select('project_id, created_at')
    .in('project_id', projectIds)
    .order('created_at', { ascending: false })

  // Aggregate client-side
  const candidateMap: Record<string, { count: number; topCQI: number | null }> = {}
  for (const c of candidates ?? []) {
    if (!candidateMap[c.project_id]) candidateMap[c.project_id] = { count: 0, topCQI: null }
    candidateMap[c.project_id].count++
    if (c.cqi_score !== null) {
      const cur = candidateMap[c.project_id].topCQI
      if (cur === null || c.cqi_score > cur) {
        candidateMap[c.project_id].topCQI = c.cqi_score
      }
    }
  }

  // First activity entry per project is the latest (sorted desc)
  const activityMap: Record<string, string> = {}
  for (const a of activities ?? []) {
    if (!activityMap[a.project_id]) activityMap[a.project_id] = a.created_at
  }

  const enriched: ProjectListItem[] = projects.map((p: {
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
    candidate_count:  candidateMap[p.id]?.count   ?? 0,
    top_cqi:          candidateMap[p.id]?.topCQI  ?? null,
    last_activity_at: activityMap[p.id]            ?? null,
    members:          (p.project_members ?? []).map((m) => ({
      user_id: m.user_id,
      role:    m.role as ProjectListItem['members'][number]['role'],
    })),
    is_owner: p.owner_id === user.id,
  }))

  return NextResponse.json({ projects: enriched })
}
