import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { ProjectActivityType } from '@/types/database'

// PATCH /api/projects/[id]/candidates/[candidateId]/react
// Body: { starred?: boolean } OR { reaction?: 'up' | 'down' | null }

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; candidateId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { starred?: unknown; reaction?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verify project access
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title, project_members(user_id, role)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find((m: { user_id: string }) => m.user_id === user.id)
  const isOwner      = project.owner_id === user.id
  const callerRole   = callerMember?.role ?? (isOwner ? 'owner' : null)
  if (!callerRole) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  // Fetch candidate
  const { data: candidate } = await supabase
    .from('project_candidates')
    .select('id, candidate_name, starred, reaction')
    .eq('id', params.candidateId)
    .eq('project_id', params.id)
    .single()

  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updatePayload: Record<string, unknown> = {}
  let activityType: ProjectActivityType | null = null
  let activityMeta: Record<string, unknown>    = {}

  if ('starred' in body && typeof body.starred === 'boolean') {
    updatePayload.starred = body.starred
    activityType = 'candidate_starred'
    activityMeta = { candidate_name: candidate.candidate_name, starred: body.starred }
  }

  if ('reaction' in body) {
    const newReaction = body.reaction === null ? null : (body.reaction as string)
    // Toggle: if already this reaction, clear it
    updatePayload.reaction = candidate.reaction === newReaction ? null : newReaction
    activityType = 'candidate_reacted'
    activityMeta = { candidate_name: candidate.candidate_name, reaction: updatePayload.reaction }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  await supabase
    .from('project_candidates')
    .update(updatePayload)
    .eq('id', params.candidateId)

  // Notify project owner if someone else starred/reacted
  if (!isOwner && activityType) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user email for notification
    const { data: userData } = await admin.auth.admin.getUserById(user.id)
    const actorEmail = userData?.user?.email ?? 'A team member'
    const actorName  = actorEmail.split('@')[0]

    let notifTitle   = ''
    let notifMessage = ''

    if (activityType === 'candidate_starred' && updatePayload.starred) {
      notifTitle   = `${actorName} starred ${candidate.candidate_name}`
      notifMessage = `in ${project.title}`
    } else if (activityType === 'candidate_reacted') {
      const reactionLabel = updatePayload.reaction === 'up' ? 'thumbs up' : updatePayload.reaction === 'down' ? 'thumbs down' : 'removed reaction'
      notifTitle   = `${actorName} gave ${candidate.candidate_name} a ${reactionLabel}`
      notifMessage = `in ${project.title}`
    }

    if (notifTitle) {
      await admin.from('notifications').insert({
        user_id: project.owner_id,
        type:    'project_shared', // reusing existing type
        title:   notifTitle,
        message: notifMessage,
        link:    `/dashboard/projects/${params.id}`,
      })
    }

    await admin.from('project_activity').insert({
      project_id:    params.id,
      user_id:       user.id,
      action_type:   activityType,
      metadata_json: activityMeta,
    })
  }

  return NextResponse.json({
    starred:  updatePayload.starred  ?? candidate.starred,
    reaction: updatePayload.reaction !== undefined ? updatePayload.reaction : candidate.reaction,
  })
}
