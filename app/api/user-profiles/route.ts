import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/user-profiles?ids=id1,id2,id3
// Returns a map of userId → { avatar_url, display_name, job_title }
// Used by UserAvatar component to batch-fetch profiles.
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get('ids')
  if (!ids) return NextResponse.json({})

  const userIds = ids.split(',').filter(Boolean).slice(0, 50)  // max 50
  if (userIds.length === 0) return NextResponse.json({})

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({}, { status: 401 })

  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, avatar_url, display_name, job_title')
    .in('user_id', userIds)

  const map: Record<string, { avatar_url: string | null; display_name: string | null; job_title: string | null }> = {}
  for (const row of data ?? []) {
    map[row.user_id] = {
      avatar_url:   row.avatar_url  ?? null,
      display_name: row.display_name ?? null,
      job_title:    row.job_title   ?? null,
    }
  }

  return NextResponse.json(map)
}

// PATCH /api/user-profiles — update own profile fields
export async function PATCH(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { display_name?: unknown; job_title?: unknown; linkedin_url?: unknown; phone?: unknown; avatar_url?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if ('display_name'  in body) updates.display_name  = typeof body.display_name  === 'string' ? body.display_name.trim()  || null : null
  if ('job_title'     in body) updates.job_title     = typeof body.job_title     === 'string' ? body.job_title.trim()     || null : null
  if ('linkedin_url'  in body) updates.linkedin_url  = typeof body.linkedin_url  === 'string' ? body.linkedin_url.trim()  || null : null
  if ('phone'         in body) updates.phone         = typeof body.phone         === 'string' ? body.phone.trim()         || null : null
  if ('avatar_url'    in body) updates.avatar_url    = typeof body.avatar_url    === 'string' ? body.avatar_url.trim()    || null : null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Use admin client to bypass RLS (user is already authenticated above)
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('user_profiles').update(updates).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message ?? 'Update failed' }, { status: 500 })

  return NextResponse.json({ success: true })
}
