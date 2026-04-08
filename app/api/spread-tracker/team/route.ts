import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Check agency plan + owner role
  const { data: profile } = await supabase.from('user_profiles').select('plan_tier').eq('user_id', user.id).single()
  if (!profile || profile.plan_tier !== 'agency') {
    return NextResponse.json({ error: 'Agency plan required' }, { status: 403 })
  }

  // Find teams where current user is owner
  const { data: ownedTeams } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')

  if (!ownedTeams || ownedTeams.length === 0) {
    return NextResponse.json({ members: [] })
  }

  const teamIds = ownedTeams.map((t: { team_id: string }) => t.team_id)

  // Get all team member user_ids (excluding current user)
  const { data: members } = await supabase
    .from('team_members')
    .select('user_id, user_profiles!inner(full_name, email)')
    .in('team_id', teamIds)
    .neq('user_id', user.id)

  if (!members || members.length === 0) {
    return NextResponse.json({ members: [] })
  }

  const memberIds = members.map((m: { user_id: string }) => m.user_id)

  // Fetch all team members' placements via admin client (bypasses RLS)
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any
  const { data: placements } = await db
    .from('spread_placements')
    .select('*')
    .in('user_id', memberIds)
    .order('weekly_spread', { ascending: false })

  // Build member info map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberMap: Record<string, { name: string; email: string }> = {}
  for (const m of members) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (m as any).user_profiles
    memberMap[m.user_id] = {
      name: p?.full_name ?? p?.email ?? 'Unknown',
      email: p?.email ?? '',
    }
  }

  return NextResponse.json({
    members: memberIds.map((id: string) => ({
      user_id: id,
      ...memberMap[id],
      placements: (placements ?? []).filter((p: { user_id: string }) => p.user_id === id),
    })),
  })
}
