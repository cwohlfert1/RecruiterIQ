import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: profile } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'manager') {
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })
  }

  // Verify assessment belongs to this manager
  const { data: assessment } = await db
    .from('assessments')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as { decision: string; notes?: string }
  const { decision, notes } = body

  if (!decision || !['approve', 'do_not_submit'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision value' }, { status: 400 })
  }

  const { error } = await db
    .from('assessment_sessions')
    .update({
      recruiter_decision: decision,
      decision_notes:     notes?.trim() || null,
    })
    .eq('id', params.sessionId)
    .eq('assessment_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
