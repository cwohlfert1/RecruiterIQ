import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/companies?q=text   — search companies accessible to this user
export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  let query = supabase
    .from('companies')
    .select('id, name, website, logo_url, industry')
    .eq('agency_owner_id', user.id)
    .order('name', { ascending: true })
    .limit(20)

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }

  return NextResponse.json({ companies: data ?? [] })
}

// POST /api/companies   — create a new company
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { name?: unknown; website?: unknown; industry?: unknown; logo_url?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, website, industry, logo_url } = body

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ error: 'name must be 100 characters or fewer' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('companies')
    .insert({
      agency_owner_id: user.id,
      name:            name.trim(),
      website:         typeof website === 'string' && website.trim() ? website.trim() : null,
      industry:        typeof industry === 'string' && industry.trim() ? industry.trim() : null,
      logo_url:        typeof logo_url === 'string' && logo_url.trim() ? logo_url.trim() : null,
    })
    .select('id, name, website, logo_url, industry')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
  }

  return NextResponse.json({ company: data }, { status: 201 })
}
