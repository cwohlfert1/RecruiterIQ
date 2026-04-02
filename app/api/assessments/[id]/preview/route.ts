import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
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

  const { data: assessment } = await db
    .from('assessments')
    .select('id, title, description, role, time_limit_minutes, proctoring_config, question_order, presentation_mode')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: questions } = await db
    .from('assessment_questions')
    .select('*')
    .eq('assessment_id', params.id)
    .order('sort_order')

  return NextResponse.json({ assessment, questions: questions ?? [] })
}
