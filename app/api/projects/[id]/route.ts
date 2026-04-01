import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── DELETE — owner only ──────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  return NextResponse.json({ success: true })
}

// ─── GET ──────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: project, error } = await supabase
    .from('projects')
    .select('*, project_members(id, user_id, role, added_by, added_at)')
    .eq('id', params.id)
    .single()

  if (error || !project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Determine caller's role within this project
  const callerMember = (project.project_members ?? []).find(
    (m: { user_id: string }) => m.user_id === user.id
  )
  const callerRole = callerMember?.role ?? (project.owner_id === user.id ? 'owner' : null)

  return NextResponse.json({
    project: {
      ...project,
      caller_role: callerRole,
    },
  })
}
