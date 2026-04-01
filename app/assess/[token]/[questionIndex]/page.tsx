import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { AssessmentTaker } from '@/components/assess/assessment-taker'
import type { ProctoringConfig, AssessmentQuestion } from '@/types/database'

export default async function AssessmentQuestionPage({
  params,
}: {
  params: { token: string; questionIndex: string }
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: invite } = await admin
    .from('assessment_invites')
    .select('id, assessment_id, candidate_name, status')
    .eq('token', params.token)
    .eq('status', 'started')
    .single() as { data: { id: string; assessment_id: string; candidate_name: string; status: string } | null }

  if (!invite) notFound()

  const { data: session } = await admin
    .from('assessment_sessions')
    .select('id, started_at')
    .eq('invite_id', invite.id)
    .eq('status', 'in_progress')
    .single() as { data: { id: string; started_at: string } | null }

  if (!session) notFound()

  const [assessmentRes, questionsRes] = await Promise.all([
    admin.from('assessments').select('title, time_limit_minutes, question_display, proctoring_config').eq('id', invite.assessment_id).single(),
    admin.from('assessment_questions').select('*').eq('assessment_id', invite.assessment_id).order('sort_order'),
  ]) as [
    { data: { title: string; time_limit_minutes: number | null; question_display: string | null; proctoring_config: unknown } | null },
    { data: AssessmentQuestion[] | null }
  ]

  if (!assessmentRes.data) notFound()

  const questions = questionsRes.data ?? []
  const questionIndex = parseInt(params.questionIndex, 10)

  if (isNaN(questionIndex) || questionIndex < 1 || questionIndex > questions.length) notFound()

  // Load any existing saved responses
  const { data: savedResponses } = await admin
    .from('assessment_question_responses')
    .select('question_id, answer_text, selected_option')
    .eq('session_id', session.id) as { data: { question_id: string; answer_text: string | null; selected_option: string | null }[] | null }

  return (
    <AssessmentTaker
      token={params.token}
      sessionId={session.id}
      candidateName={invite.candidate_name}
      assessment={assessmentRes.data}
      questions={questions}
      currentIndex={questionIndex - 1}
      startedAt={session.started_at}
      savedResponses={savedResponses ?? []}
      proctoringConfig={(assessmentRes.data.proctoring_config ?? {}) as ProctoringConfig}
    />
  )
}
