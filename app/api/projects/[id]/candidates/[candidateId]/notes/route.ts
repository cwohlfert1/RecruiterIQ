import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// ─── Helpers ──────────────────────────────────────────────────

async function verifyAccess(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  userId: string,
  requireCollaborator = false
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase as any)
    .from('projects')
    .select('id, owner_id, project_members(user_id, role)')
    .eq('id', projectId)
    .single()

  if (!project) return null

  const members: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find((m: { user_id: string; role: string }) => m.user_id === userId)
  const isOwner      = project.owner_id === userId
  const callerRole   = callerMember?.role ?? (isOwner ? 'owner' : null)

  if (!callerRole) return null
  if (requireCollaborator && callerRole === 'viewer') return null

  return callerRole
}

// ─── GET: list notes ──────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; candidateId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const role = await verifyAccess(supabase, params.id, user.id)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: notes, error } = await supabase
    .from('project_candidate_notes')
    .select('id, user_id, content, created_at')
    .eq('candidate_id', params.candidateId)
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve emails via admin client
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const userIds = Array.from(new Set((notes ?? []).map((n: { user_id: string }) => n.user_id))) as string[]
  const emailMap: Record<string, string | null> = {}
  await Promise.all(userIds.map(async (uid: string) => {
    if (uid === user.id && user.email) {
      emailMap[uid] = user.email
    } else {
      const { data } = await admin.auth.admin.getUserById(uid)
      emailMap[uid] = data?.user?.email ?? null
    }
  }))

  const enriched = (notes ?? []).map((n: { id: string; user_id: string; content: string; created_at: string }) => ({
    ...n,
    user_email: emailMap[n.user_id] ?? null,
  }))

  return NextResponse.json({ notes: enriched })
}

// ─── POST: add note ───────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; candidateId: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const role = await verifyAccess(supabase, params.id, user.id, true)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { content } = body as { content: string }

  if (!content?.trim() || content.trim().length > 2000) {
    return NextResponse.json({ error: 'content is required (max 2000 chars)' }, { status: 400 })
  }

  const { data: note, error } = await supabase
    .from('project_candidate_notes')
    .insert({
      candidate_id: params.candidateId,
      project_id:   params.id,
      user_id:      user.id,
      content:      content.trim(),
    })
    .select('id, user_id, content, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    note: { ...note, user_email: user.email ?? null },
  })
}
