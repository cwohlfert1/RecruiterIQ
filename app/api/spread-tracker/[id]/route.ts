import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recalcWatermark } from '@/lib/spread-tracker/watermark'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only allow updating own placements
  const { data: existing } = await supabase
    .from('spread_placements')
    .select('user_id')
    .eq('id', params.id)
    .single()

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const allowed = ['consultant_name', 'client_company', 'client_color', 'role', 'weekly_spread', 'contract_end_date', 'status', 'notes']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates[key] = key === 'weekly_spread' ? Number(body[key]) : body[key]
    }
  }

  const { data: placement, error } = await supabase
    .from('spread_placements')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  await recalcWatermark(user.id)
  return NextResponse.json({ placement })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { data: existing } = await supabase
    .from('spread_placements')
    .select('user_id')
    .eq('id', params.id)
    .single()

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase.from('spread_placements').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

  await recalcWatermark(user.id)
  return NextResponse.json({ ok: true })
}
