import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; candidateId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { tags } = body as { tags: unknown }

  if (!Array.isArray(tags) || !tags.every(t => typeof t === 'string')) {
    return NextResponse.json({ error: 'tags must be an array of strings' }, { status: 400 })
  }

  // Verify project access (collaborator+)
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, project_members(user_id, role)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find((m: { user_id: string; role: string }) => m.user_id === user.id)
  const isOwner      = project.owner_id === user.id
  const callerRole   = callerMember?.role ?? (isOwner ? 'owner' : null)

  if (!callerRole || callerRole === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('project_candidates')
    .update({ tags_json: tags })
    .eq('id', params.candidateId)
    .eq('project_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tags })
}
