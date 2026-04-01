import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Only owner can remove members
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  // Fetch the member row to validate it belongs to this project
  const { data: member } = await supabase
    .from('project_members')
    .select('id, user_id, role')
    .eq('id', params.memberId)
    .eq('project_id', params.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the project owner' }, { status: 400 })
  }

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', params.memberId)

  if (error) return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })

  return NextResponse.json({ success: true })
}
