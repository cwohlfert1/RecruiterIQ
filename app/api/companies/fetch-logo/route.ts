import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/companies/fetch-logo
// Body: { domain: string, company_id?: string }
// Tests Clearbit logo URL, optionally saves to company row
// Returns: { logo_url: string | null }

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { domain?: unknown; company_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { domain, company_id } = body

  if (typeof domain !== 'string' || !domain.trim()) {
    return NextResponse.json({ logo_url: null })
  }

  // Normalize domain (strip protocol, www, trailing slash)
  const normalizedDomain = domain.trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()

  if (!normalizedDomain) {
    return NextResponse.json({ logo_url: null })
  }

  const clearbitUrl = `https://logo.clearbit.com/${normalizedDomain}`

  // Test if logo exists
  let logoUrl: string | null = null
  try {
    const headRes = await fetch(clearbitUrl, { method: 'HEAD' })
    if (headRes.ok) {
      logoUrl = clearbitUrl
    }
  } catch {
    // Clearbit unreachable — return null gracefully
  }

  // Save to company row if company_id provided and logo found
  if (logoUrl && typeof company_id === 'string' && company_id) {
    await supabase
      .from('companies')
      .update({ logo_url: logoUrl, website: normalizedDomain })
      .eq('id', company_id)
      .eq('agency_owner_id', user.id)
  }

  return NextResponse.json({ logo_url: logoUrl })
}
