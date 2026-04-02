import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data, error } = await db
    .from('assessment_sessions')
    .select(`
      id,
      skill_score,
      trust_score,
      completed_at,
      assessment_invites (
        candidate_name,
        assessments (
          title,
          role
        )
      )
    `)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type RawSession = {
    id: string
    skill_score: number | null
    trust_score: number | null
    completed_at: string
    assessment_invites: {
      candidate_name: string
      assessments: { title: string; role: string } | null
    } | null
  }

  const sessions = (data as RawSession[])
    .filter(s => s.assessment_invites?.candidate_name)
    .map(s => ({
      id:            s.id,
      candidateName: s.assessment_invites!.candidate_name,
      role:          s.assessment_invites!.assessments?.role ?? s.assessment_invites!.assessments?.title ?? 'Assessment',
      skillScore:    s.skill_score,
      trustScore:    s.trust_score,
      completedAt:   s.completed_at,
    }))

  return NextResponse.json({ sessions })
}
