import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const PAGE_SIZE = 20

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Verify membership
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, project_members(user_id)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isMember =
    project.owner_id === user.id ||
    (project.project_members ?? []).some((m: { user_id: string }) => m.user_id === user.id)

  if (!isMember) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const url  = new URL(req.url)
  const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10))

  const { data: items, error } = await supabase
    .from('project_activity')
    .select('id, action_type, metadata_json, user_id, created_at')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (error) return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })

  // Resolve user emails via admin client
  const userIds = Array.from(new Set(
    (items ?? []).map((i: { user_id: string | null }) => i.user_id).filter(Boolean)
  )) as string[]

  const emailMap: Record<string, string> = {}

  if (userIds.length > 0) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await Promise.all(userIds.map(async uid => {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data?.user?.email) emailMap[uid] = data.user.email
    }))
  }

  const enriched = (items ?? []).map((item: {
    id: string
    action_type: string
    metadata_json: Record<string, unknown>
    user_id: string | null
    created_at: string
  }) => ({
    ...item,
    user_email: item.user_id ? (emailMap[item.user_id] ?? null) : null,
  }))

  return NextResponse.json({
    items:    enriched,
    nextPage: (items ?? []).length === PAGE_SIZE ? page + 1 : null,
  })
}
