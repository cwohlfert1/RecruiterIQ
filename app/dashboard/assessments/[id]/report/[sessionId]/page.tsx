import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProctoringReport } from '@/components/assessments/proctoring-report'
import type { UserProfile } from '@/types/database'

export const metadata = { title: 'Proctoring Report' }

export default async function ReportPage({
  params,
}: {
  params: { id: string; sessionId: string }
}) {
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
  if (safeProfile.role !== 'manager') redirect('/dashboard')

  // Fetch assessment (must belong to this manager)
  const { data: assessment } = await db
    .from('assessments')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!assessment) notFound()

  // Fetch session
  const { data: session } = await db
    .from('assessment_sessions')
    .select('*')
    .eq('id', params.sessionId)
    .eq('assessment_id', params.id)
    .single()

  if (!session) notFound()

  // Fetch invite (for candidate name/email)
  const { data: invite } = await db
    .from('assessment_invites')
    .select('*')
    .eq('id', session.invite_id)
    .single()

  const [questionsRes, responsesRes, eventsRes, snapshotsRes] = await Promise.all([
    db
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', params.id)
      .order('sort_order'),
    db
      .from('assessment_question_responses')
      .select('*')
      .eq('session_id', params.sessionId),
    db
      .from('proctoring_events')
      .select('*')
      .eq('session_id', params.sessionId)
      .order('timestamp'),
    db
      .from('assessment_snapshots')
      .select('*')
      .eq('session_id', params.sessionId)
      .order('taken_at'),
  ])

  return (
    <ProctoringReport
      assessment={assessment}
      session={session}
      invite={invite}
      questions={questionsRes.data ?? []}
      responses={responsesRes.data ?? []}
      events={eventsRes.data ?? []}
      snapshots={snapshotsRes.data ?? []}
    />
  )
}
