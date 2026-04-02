import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

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

  const isHistory = req.nextUrl.searchParams.get('history') === '1'

  if (isHistory) {
    const { data: archived } = await supabase
      .from('project_boolean_strings')
      .select('id, user_id, linkedin_string, indeed_string, variant_type, created_at')
      .eq('project_id', params.id)
      .eq('is_active', false)
      .order('created_at', { ascending: false })
      .limit(20)

    const userIds = Array.from(new Set((archived ?? []).map((s: { user_id: string }) => s.user_id)))
    const adminC  = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const emailMap: Record<string, string> = {}
    await Promise.all(userIds.map(async (uid) => {
      const { data } = await adminC.auth.admin.getUserById(uid as string)
      if (data?.user?.email) emailMap[uid as string] = data.user.email
    }))

    return NextResponse.json({
      archived: (archived ?? []).map((s: Record<string, unknown>) => ({
        ...s,
        user_email: emailMap[s.user_id as string] ?? s.user_id,
      })),
    })
  }

  // Fetch all active strings (both variants)
  const { data: strings } = await supabase
    .from('project_boolean_strings')
    .select('id, user_id, linkedin_string, indeed_string, variant_type, refinement_count, feedback, created_at')
    .eq('project_id', params.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const activeStrings: Array<{
    id: string; user_id: string; linkedin_string: string; indeed_string: string
    variant_type: string | null; refinement_count: number; feedback: string | null; created_at: string
  }> = strings ?? []

  const { count: archiveCount } = await supabase
    .from('project_boolean_strings')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', params.id)
    .eq('is_active', false)

  // Resolve emails for manager view
  let emailMap: Record<string, string> = {}
  if (isManagerOrOwner && activeStrings.length > 0) {
    const userIds = Array.from(new Set(activeStrings.map(s => s.user_id)))
    const adminC  = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await Promise.all(userIds.map(async uid => {
      const { data } = await adminC.auth.admin.getUserById(uid)
      if (data?.user?.email) emailMap[uid] = data.user.email
    }))
  }

  // My variants (targeted + broad)
  const myTargeted = activeStrings.find(s => s.user_id === user.id && (s.variant_type === 'targeted' || s.variant_type === null)) ?? null
  const myBroad    = activeStrings.find(s => s.user_id === user.id && s.variant_type === 'broad') ?? null

  // Legacy: if only one row (no variant_type), treat as targeted
  const hasAnyString = myTargeted !== null || myBroad !== null

  // Manager view: group by user
  const allStrings = isManagerOrOwner
    ? activeStrings
        .filter(s => s.variant_type === 'targeted' || s.variant_type === null)
        .map(s => ({
          ...s,
          user_email: emailMap[s.user_id] ?? s.user_id,
          broad: activeStrings.find(b => b.user_id === s.user_id && b.variant_type === 'broad') ?? null,
        }))
    : []

  return NextResponse.json({
    myTargeted: myTargeted ? { ...myTargeted, user_email: emailMap[myTargeted.user_id] ?? myTargeted.user_id } : null,
    myBroad:    myBroad    ? { ...myBroad,    user_email: emailMap[myBroad.user_id]    ?? myBroad.user_id    } : null,
    hasAnyString,
    allStrings,
    hasHistory: (archiveCount ?? 0) > 0,
    // Legacy compat
    myString: myTargeted ? { ...myTargeted, user_email: emailMap[myTargeted.user_id] ?? myTargeted.user_id } : null,
  })
}
