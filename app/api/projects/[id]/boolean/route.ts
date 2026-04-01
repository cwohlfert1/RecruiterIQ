import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Verify project access + get caller role
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, project_members(id, user_id, role)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find(m => m.user_id === user.id)
  const isOwner      = project.owner_id === user.id
  const callerRole   = callerMember?.role ?? (isOwner ? 'owner' : null)

  if (!callerRole) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const isManagerOrOwner = isOwner || callerRole === 'owner'

  // Fetch active boolean strings
  const { data: strings } = await supabase
    .from('project_boolean_strings')
    .select('id, user_id, linkedin_string, indeed_string, is_active, created_at')
    .eq('project_id', params.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const activeStrings: Array<{
    id: string; user_id: string; linkedin_string: string; indeed_string: string; created_at: string
  }> = strings ?? []

  // Check if any archived strings exist
  const { count: archiveCount } = await supabase
    .from('project_boolean_strings')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', params.id)
    .eq('is_active', false)

  // Resolve user emails for manager view
  let emailMap: Record<string, string> = {}

  if (isManagerOrOwner && activeStrings.length > 0) {
    const userIds = Array.from(new Set(activeStrings.map(s => s.user_id)))
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await Promise.all(userIds.map(async uid => {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data?.user?.email) emailMap[uid] = data.user.email
    }))
  }

  const myString = activeStrings.find(s => s.user_id === user.id) ?? null

  const allStrings = isManagerOrOwner
    ? activeStrings.map(s => ({ ...s, user_email: emailMap[s.user_id] ?? s.user_id }))
    : []

  return NextResponse.json({
    myString:   myString ? { ...myString, user_email: emailMap[myString.user_id] ?? myString.user_id } : null,
    allStrings,
    hasHistory: (archiveCount ?? 0) > 0,
  })
}
