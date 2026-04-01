import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ConsentScreen } from '@/components/assess/consent-screen'
import type { ProctoringConfig } from '@/types/database'

export default async function ConsentPage({
  params,
}: {
  params: { token: string }
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: invite } = await admin
    .from('assessment_invites')
    .select('id, assessment_id, candidate_name, status')
    .eq('token', params.token)
    .single() as { data: { id: string; assessment_id: string; candidate_name: string; status: string } | null }

  if (!invite || invite.status === 'completed') notFound()

  const { data: assessment } = await admin
    .from('assessments')
    .select('title, proctoring_config')
    .eq('id', invite.assessment_id)
    .single() as { data: { title: string; proctoring_config: unknown } | null }

  if (!assessment) notFound()

  const config = (assessment.proctoring_config ?? {}) as ProctoringConfig

  return (
    <ConsentScreen
      token={params.token}
      candidateName={invite.candidate_name}
      assessmentTitle={assessment.title}
      proctoringConfig={config}
    />
  )
}
