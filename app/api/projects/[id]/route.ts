import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
