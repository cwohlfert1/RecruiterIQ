import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { AssessLanding } from '@/components/assess/assess-landing'

export default async function AssessLandingPage({
  params,
}: {
  params: { token: string }
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: invite } = await admin
    .from('assessment_invites')
    .select('id, assessment_id, candidate_name, expires_at, status')
    .eq('token', params.token)
    .single() as { data: { id: string; assessment_id: string; candidate_name: string; expires_at: string | null; status: string } | null }

  if (!invite || invite.status === 'completed') notFound()

  const expired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false

  const { data: assessment } = await admin
    .from('assessments')
    .select('title, description, role, time_limit_minutes, question_display, proctoring_config')
    .eq('id', invite.assessment_id)
    .single() as { data: { title: string; description: string | null; role: string | null; time_limit_minutes: number | null; question_display: string | null; proctoring_config: unknown } | null }

  if (!assessment) notFound()

  const { count: questionCount } = await admin
    .from('assessment_questions')
    .select('*', { count: 'exact', head: true })
    .eq('assessment_id', invite.assessment_id) as { count: number | null }

  return (
    <AssessLanding
      token={params.token}
      candidateName={invite.candidate_name}
      assessment={assessment}
      questionCount={questionCount ?? 0}
      expired={expired}
      alreadyStarted={invite.status === 'started'}
      expiresAt={invite.expires_at ?? null}
    />
  )
}
