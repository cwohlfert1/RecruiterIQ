import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; candidateId: string; noteId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Fetch the note (RLS will enforce own-note-only delete, but double-check here)
  const { data: note } = await supabase
    .from('project_candidate_notes')
    .select('id, user_id')
    .eq('id', params.noteId)
    .eq('project_id', params.id)
    .eq('candidate_id', params.candidateId)
    .single()

  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  if (note.user_id !== user.id) return NextResponse.json({ error: 'You can only delete your own notes' }, { status: 403 })

  const { error } = await supabase
    .from('project_candidate_notes')
    .delete()
    .eq('id', params.noteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
