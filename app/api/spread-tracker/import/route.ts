import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recalcWatermark } from '@/lib/spread-tracker/watermark'
import { checkRateLimit, getRateLimitKey, rateLimitResponse, RATE_BULK } from '@/lib/security/rate-limit'

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

  // Rate limit: 5 bulk imports/min per user
  const rl = checkRateLimit(getRateLimitKey(req, 'spread-import', user.id), RATE_BULK)
  if (!rl.allowed) return rateLimitResponse(rl)

  let body: { rows?: ImportRow[]; client_color_map?: Record<string, string> }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Security: cap bulk import at 500 rows to prevent abuse
  const MAX_IMPORT_ROWS = 500
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_IMPORT_ROWS) : []
  const colorMap: Record<string, string> = body.client_color_map && typeof body.client_color_map === 'object' ? body.client_color_map : {}
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
    const spreadRaw = typeof r.weekly_spread === 'string'
      ? r.weekly_spread.replace(/[$,\s]/g, '')
      : r.weekly_spread
    const spread = Number(spreadRaw)
    const rawDate = r.contract_end_date
    const endDate = parseDate(rawDate)
    const status = typeof r.status === 'string' && VALID_STATUSES.includes(r.status.trim().toLowerCase().replace(/\s+/g, '_'))
      ? r.status.trim().toLowerCase().replace(/\s+/g, '_')
      : 'active'
    const notes = typeof r.notes === 'string' ? r.notes.trim() || null : null

    if (!name) { errors.push({ row: i + 1, reason: 'Missing consultant name' }); continue }
    if (!company) { errors.push({ row: i + 1, reason: 'Missing client company' }); continue }
    if (!role) { errors.push({ row: i + 1, reason: 'Missing role' }); continue }
    if (!spread || isNaN(spread) || spread <= 0) { errors.push({ row: i + 1, reason: 'Invalid weekly spread' }); continue }
    if (!endDate) { errors.push({ row: i + 1, reason: 'Missing or invalid contract end date' }); continue }

    valid.push({
      user_id: user.id,
      consultant_name: name,
      client_company: company,
      client_color: colorMap[company.toLowerCase()] || '#6366F1',
      role,
      weekly_spread: spread,
      contract_end_date: endDate,
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

/**
 * Parse dates from various formats:
 * - ISO strings: "2025-06-30"
 * - US format: "6/30/2025", "06/30/2025"
 * - Excel serial numbers: 45658 (days since 1900-01-01, with Excel's leap year bug)
 * - Formatted strings from SheetJS with cellDates: "6/30/25", "Jun 30, 2025", etc.
 * Returns YYYY-MM-DD string or null if unparseable.
 */
function parseDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null

  // Excel serial number (numeric)
  if (typeof raw === 'number' && raw > 0 && raw < 200000) {
    // Excel epoch: Jan 1 1900 = serial 1, but Excel incorrectly treats 1900 as leap year
    // So serial 60 = Feb 29 1900 (doesn't exist). For dates > 60, subtract 1.
    const adjusted = raw > 60 ? raw - 1 : raw
    const ms = (adjusted - 1) * 86400000
    const epoch = new Date(1900, 0, 1).getTime()
    const d = new Date(epoch + ms)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    return null
  }

  const str = String(raw).trim()
  if (!str) return null

  // Try direct parse (handles ISO, most US/EU formats)
  const d = new Date(str)
  if (!isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2100) {
    return d.toISOString().split('T')[0]
  }

  // Try MM/DD/YY with 2-digit year
  const shortMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/)
  if (shortMatch) {
    const [, m, day, y] = shortMatch
    const year = Number(y) + (Number(y) < 50 ? 2000 : 1900)
    const d2 = new Date(year, Number(m) - 1, Number(day))
    if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0]
  }

  return null
}
