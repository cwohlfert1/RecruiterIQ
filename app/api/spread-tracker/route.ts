import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const [{ data: placements }, { data: watermark }] = await Promise.all([
    supabase.from('spread_placements').select('*').eq('user_id', user.id).order('weekly_spread', { ascending: false }),
    supabase.from('spread_high_watermark').select('*').eq('user_id', user.id).single(),
  ])

  return NextResponse.json({
    placements: placements ?? [],
    watermark: watermark ?? { high_amount: 0, achieved_at: null },
  })
}

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Plan gate — pro or agency only
  const { data: profile } = await supabase.from('user_profiles').select('plan_tier').eq('user_id', user.id).single()
  if (!profile || profile.plan_tier === 'free') {
    return NextResponse.json({ error: 'plan_required' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { consultant_name, client_company, client_color, role, weekly_spread, contract_end_date, status, notes } = body

  if (!consultant_name || !client_company || !role || weekly_spread == null || !contract_end_date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: placement, error } = await supabase.from('spread_placements').insert({
    user_id: user.id,
    consultant_name,
    client_company,
    client_color: client_color || '#6366F1',
    role,
    weekly_spread: Number(weekly_spread),
    contract_end_date,
    status: status || 'active',
    notes: notes || null,
  }).select().single()

  if (error) return NextResponse.json({ error: 'Failed to create placement' }, { status: 500 })

  await recalcWatermark(user.id)
  return NextResponse.json({ placement })
}

async function recalcWatermark(userId: string) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data: rows } = await db
    .from('spread_placements')
    .select('weekly_spread')
    .eq('user_id', userId)
    .eq('status', 'active')

  const total = (rows ?? []).reduce((sum: number, r: { weekly_spread: number }) => sum + Number(r.weekly_spread), 0)

  const { data: existing } = await db
    .from('spread_high_watermark')
    .select('high_amount')
    .eq('user_id', userId)
    .single()

  if (!existing) {
    await db.from('spread_high_watermark').insert({ user_id: userId, high_amount: total, achieved_at: new Date().toISOString() })
  } else if (total > Number(existing.high_amount)) {
    await db.from('spread_high_watermark').update({ high_amount: total, achieved_at: new Date().toISOString() }).eq('user_id', userId)
  }
}

export { recalcWatermark }
