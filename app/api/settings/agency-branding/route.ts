import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — return current agency branding
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('user_profiles')
    .select('agency_name, agency_logo_url')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    agency_name:     data?.agency_name     ?? null,
    agency_logo_url: data?.agency_logo_url ?? null,
  })
}

// POST — save agency name and/or logo upload
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''

  let agencyName:    string | undefined
  let agencyLogoUrl: string | undefined

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    agencyName = form.get('agency_name') as string | undefined

    const file = form.get('logo') as File | null
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'Logo must be under 2MB' }, { status: 400 })
      }
      const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `${user.id}/agency-logo.${ext}`
      const buf  = Buffer.from(await file.arrayBuffer())

      const admin = createAdminClient()
      const { error: uploadErr } = await admin.storage
        .from('agency-assets')
        .upload(path, buf, {
          contentType: file.type,
          upsert:      true,
        })

      if (uploadErr) {
        return NextResponse.json({ error: uploadErr.message }, { status: 500 })
      }

      const { data: urlData } = admin.storage
        .from('agency-assets')
        .getPublicUrl(path)

      agencyLogoUrl = urlData.publicUrl
    }
  } else {
    const body = await req.json() as { agency_name?: string }
    agencyName = body.agency_name
  }

  const updates: Record<string, string | null> = {}
  if (agencyName !== undefined) updates.agency_name     = agencyName || null
  if (agencyLogoUrl !== undefined) updates.agency_logo_url = agencyLogoUrl

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_profiles')
    .update(updates)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, agency_logo_url: agencyLogoUrl ?? null })
}
