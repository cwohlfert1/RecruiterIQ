import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const PLAN_LIMITS: Record<string, number> = {
  free:   1,
  pro:    10,
  agency: Infinity,
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan_tier')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Plan limit check — count active projects owned by user
  const limit = PLAN_LIMITS[profile.plan_tier as string] ?? 1
  if (limit !== Infinity) {
    const { count } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .in('status', ['active', 'on_hold'])

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: 'plan_limit_reached', limit, planTier: profile.plan_tier },
        { status: 403 }
      )
    }
  }

  // Parse body
  let body: {
    title?: unknown
    client_name?: unknown
    jd_text?: unknown
    member_ids?: unknown
    company_id?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, client_name, jd_text, member_ids, company_id } = body

  if (typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (title.trim().length > 100) {
    return NextResponse.json({ error: 'title must be 100 characters or fewer' }, { status: 400 })
  }
  if (typeof client_name !== 'string' || !client_name.trim()) {
    return NextResponse.json({ error: 'client_name is required' }, { status: 400 })
  }
  if (client_name.trim().length > 100) {
    return NextResponse.json({ error: 'client_name must be 100 characters or fewer' }, { status: 400 })
  }

  const extraMemberIds: string[] = Array.isArray(member_ids)
    ? (member_ids as unknown[]).filter((id): id is string => typeof id === 'string')
    : []

  // Create project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      owner_id:    user.id,
      title:       title.trim(),
      client_name: client_name.trim(),
      jd_text:     typeof jd_text === 'string' && jd_text.trim() ? jd_text.trim() : null,
      company_id:  typeof company_id === 'string' && company_id.trim() ? company_id.trim() : null,
    })
    .select('id')
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }

  const projectId = project.id

  // Insert owner as 'owner' member
  await supabase.from('project_members').insert({
    project_id: projectId,
    user_id:    user.id,
    role:       'owner',
    added_by:   user.id,
  })

  // Insert additional members (Agency only — validated client-side but double-checked here)
  if (extraMemberIds.length > 0 && profile.plan_tier === 'agency') {
    const memberRows = extraMemberIds
      .filter((id) => id !== user.id)
      .map((memberId) => ({
        project_id: projectId,
        user_id:    memberId,
        role:       'collaborator' as const,
        added_by:   user.id,
      }))

    if (memberRows.length > 0) {
      await supabase.from('project_members').insert(memberRows)
    }
  }

  // Log project_created via admin client (bypasses project_activity INSERT RLS)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await admin.from('project_activity').insert({
    project_id:    projectId,
    user_id:       user.id,
    action_type:   'project_created',
    metadata_json: { project_title: title.trim(), client_name: client_name.trim() },
  })

  // Send notifications to added members
  if (extraMemberIds.length > 0) {
    const notifRows = extraMemberIds
      .filter((id) => id !== user.id)
      .map((memberId) => ({
        user_id: memberId,
        type:    'project_shared' as const,
        title:   `You've been added to a project`,
        message: `${title.trim()} for ${client_name.trim()}`,
        link:    `/dashboard/projects/${projectId}`,
      }))

    if (notifRows.length > 0) {
      await admin.from('notifications').insert(notifRows)
    }
  }

  return NextResponse.json({ id: projectId }, { status: 201 })
}
