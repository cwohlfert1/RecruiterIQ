import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/companies/fetch-logo
// Body: { website?: string, company_name?: string, domain?: string (legacy), company_id?: string }
// Uses Brandfetch Brand API to fetch logo, falls back to Google favicon
// Returns: { logo_url: string | null, brand_name?: string }

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { website?: unknown; company_name?: unknown; domain?: unknown; company_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const website      = typeof body.website      === 'string' ? body.website.trim()      : ''
  const companyName  = typeof body.company_name === 'string' ? body.company_name.trim() : ''
  const legacyDomain = typeof body.domain       === 'string' ? body.domain.trim()       : ''
  const companyId    = typeof body.company_id   === 'string' ? body.company_id          : null

  // Extract domain
  let domain: string
  if (legacyDomain) {
    // Legacy: domain already provided (may be url or plain domain)
    try {
      const url = legacyDomain.startsWith('http') ? legacyDomain : 'https://' + legacyDomain
      domain = new URL(url).hostname.replace('www.', '')
    } catch {
      domain = legacyDomain.replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase()
    }
  } else if (website) {
    try {
      const url = website.startsWith('http') ? website : 'https://' + website
      domain = new URL(url).hostname.replace('www.', '')
    } catch {
      domain = website.replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase()
    }
  } else if (companyName) {
    domain = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/\s+/g, '') + '.com'
  } else {
    return NextResponse.json({ logo_url: null })
  }

  if (!domain) return NextResponse.json({ logo_url: null })

  // ── Brandfetch Brand API ──────────────────────────────────────
  let logoUrl: string | null = null
  let brandName: string | undefined

  try {
    const res = await fetch(
      `https://api.brandfetch.io/v2/brands/${domain}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.BRANDFETCH_API_KEY}`,
        },
      }
    )

    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as any

      brandName = data.name || companyName || undefined

      // Prefer full logo over icon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logoEntry = data.logos?.find((l: any) => l.type === 'logo') ||
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        data.logos?.find((l: any) => l.type === 'icon') ||
                        data.logos?.[0]

      // Prefer SVG then PNG
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logoUrl = logoEntry?.formats?.find((f: any) => f.format === 'svg')?.src ||
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                logoEntry?.formats?.find((f: any) => f.format === 'png')?.src ||
                null
    }
  } catch (err) {
    console.error('[fetch-logo] Brandfetch error:', err)
  }

  // ── Fallback: Google favicon ──────────────────────────────────
  if (!logoUrl) {
    logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  }

  // ── Save to company row if company_id provided ────────────────
  if (companyId) {
    const updatePayload: Record<string, string> = { logo_url: logoUrl }
    if (website || legacyDomain) updatePayload.website = website || legacyDomain
    if (brandName)               updatePayload.name    = brandName

    await supabase
      .from('companies')
      .update(updatePayload)
      .eq('id', companyId)
      .eq('agency_owner_id', user.id)
  }

  return NextResponse.json({
    logo_url:   logoUrl,
    brand_name: brandName ?? null,
  })
}
