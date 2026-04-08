import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recalcWatermark } from '@/lib/spread-tracker/watermark'

interface ImportRow {
  consultant_name?: string
  client_company?: string
  role?: string
  weekly_spread?: number | string
  contract_end_date?: string
  status?: string
  notes?: string
}

const VALID_STATUSES = ['active', 'locked_up', 'falling_off']

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('user_profiles').select('plan_tier').eq('user_id', user.id).single()
  if (!profile || profile.plan_tier === 'free') {
    return NextResponse.json({ error: 'plan_required' }, { status: 403 })
  }

  let body: { rows?: ImportRow[] }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rows = Array.isArray(body.rows) ? body.rows : []
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const valid: Array<Record<string, unknown>> = []
  const errors: Array<{ row: number; reason: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const name = typeof r.consultant_name === 'string' ? r.consultant_name.trim() : ''
    const company = typeof r.client_company === 'string' ? r.client_company.trim() : ''
    const role = typeof r.role === 'string' ? r.role.trim() : ''
    const spread = Number(r.weekly_spread)
    const endDate = typeof r.contract_end_date === 'string' ? r.contract_end_date.trim() : ''
    const status = typeof r.status === 'string' && VALID_STATUSES.includes(r.status.trim().toLowerCase().replace(/\s+/g, '_'))
      ? r.status.trim().toLowerCase().replace(/\s+/g, '_')
      : 'active'
    const notes = typeof r.notes === 'string' ? r.notes.trim() || null : null

    if (!name) { errors.push({ row: i + 1, reason: 'Missing consultant name' }); continue }
    if (!company) { errors.push({ row: i + 1, reason: 'Missing client company' }); continue }
    if (!role) { errors.push({ row: i + 1, reason: 'Missing role' }); continue }
    if (!spread || isNaN(spread) || spread <= 0) { errors.push({ row: i + 1, reason: 'Invalid weekly spread' }); continue }
    if (!endDate) { errors.push({ row: i + 1, reason: 'Missing contract end date' }); continue }

    // Validate date format
    const parsed = new Date(endDate)
    if (isNaN(parsed.getTime())) { errors.push({ row: i + 1, reason: 'Invalid date format' }); continue }

    valid.push({
      user_id: user.id,
      consultant_name: name,
      client_company: company,
      client_color: '#6366F1',
      role,
      weekly_spread: spread,
      contract_end_date: parsed.toISOString().split('T')[0],
      status,
      notes,
    })
  }

  if (valid.length > 0) {
    const { error } = await supabase.from('spread_placements').insert(valid)
    if (error) {
      return NextResponse.json({ error: 'Failed to insert placements' }, { status: 500 })
    }
    await recalcWatermark(user.id)
  }

  return NextResponse.json({
    imported: valid.length,
    skipped: errors.length,
    errors,
  })
}
