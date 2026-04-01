import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { ProjectActivityType } from '@/types/database'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: {
    title?: unknown
    client_name?: unknown
    jd_text?: unknown
    status?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Fetch project to verify it exists and caller has access
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('id, owner_id, status, jd_text, title, client_name')
    .eq('id', params.id)
    .single()

  if (fetchError || !project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Build update payload — only include fields that were sent
  const updates: Record<string, unknown> = {}

  if (typeof body.title === 'string' && body.title.trim()) {
    if (body.title.trim().length > 100) {
      return NextResponse.json({ error: 'title must be 100 characters or fewer' }, { status: 400 })
    }
    updates.title = body.title.trim()
  }
  if (typeof body.client_name === 'string' && body.client_name.trim()) {
    if (body.client_name.trim().length > 100) {
      return NextResponse.json({ error: 'client_name must be 100 characters or fewer' }, { status: 400 })
    }
    updates.client_name = body.client_name.trim()
  }
  if ('jd_text' in body) {
    updates.jd_text = typeof body.jd_text === 'string' && body.jd_text.trim()
      ? body.jd_text.trim()
      : null
  }
  if (typeof body.status === 'string') {
    const validStatuses = ['active', 'filled', 'on_hold', 'archived']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }

  // Log relevant activity via admin client
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const activityRows: Array<{
    project_id: string
    user_id: string
    action_type: string
    metadata_json: Record<string, unknown>
  }> = []

  if ('jd_text' in updates) {
    activityRows.push({
      project_id:    params.id,
      user_id:       user.id,
      action_type:   'jd_updated' satisfies ProjectActivityType,
      metadata_json: {},
    })
  }

  if ('status' in updates && updates.status !== project.status) {
    activityRows.push({
      project_id:    params.id,
      user_id:       user.id,
      action_type:   'project_status_changed' satisfies ProjectActivityType,
      metadata_json: { from: project.status, to: updates.status },
    })
  }

  if (activityRows.length > 0) {
    await admin.from('project_activity').insert(activityRows)
  }

  return NextResponse.json({ success: true })
}
