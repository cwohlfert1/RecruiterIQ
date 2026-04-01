import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssessmentDetail } from '@/components/assessments/assessment-detail'
import type { UserProfile } from '@/types/database'

export const metadata = { title: 'Assessment' }

export default async function AssessmentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: profile } = await db
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')
  const safeProfile = profile as UserProfile
  if (safeProfile.role !== 'manager') redirect('/dashboard/assessments')

  const { data: assessment } = await db
    .from('assessments')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!assessment) notFound()

  const [questionsRes, invitesRes, sessionsRes] = await Promise.all([
    db
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', params.id)
      .order('sort_order'),
    db
      .from('assessment_invites')
      .select('*')
      .eq('assessment_id', params.id)
      .order('created_at', { ascending: false }),
    db
      .from('assessment_sessions')
      .select('*')
      .eq('assessment_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions: any[] = questionsRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invites:   any[] = invitesRes.data   ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions:  any[] = sessionsRes.data  ?? []

  // Build invite→session map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionByInvite: Record<string, any> = {}
  for (const s of sessions) {
    sessionByInvite[s.invite_id] = s
  }

  // Stats
  const completed = sessions.filter((s: { status: string }) => s.status === 'completed')
  const avgTrust  = completed.length > 0
    ? Math.round(completed.reduce((sum: number, s: { trust_score: number | null }) => sum + (s.trust_score ?? 0), 0) / completed.length)
    : null
  const avgSkill  = completed.length > 0
    ? Math.round(completed.reduce((sum: number, s: { skill_score: number | null }) => sum + (s.skill_score ?? 0), 0) / completed.length)
    : null

  return (
    <AssessmentDetail
      assessment={assessment}
      questions={questions}
      invites={invites}
      sessionByInvite={sessionByInvite}
      stats={{
        inviteCount:   invites.length,
        completedCount: completed.length,
        avgTrust,
        avgSkill,
      }}
    />
  )
}
