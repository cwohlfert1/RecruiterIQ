import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssessPreview } from '@/components/assess/assess-preview'

export const metadata = { title: 'Preview Assessment' }

export default async function AssessPreviewPage({
  params,
}: {
  params: { assessmentId: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: profile } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'manager') redirect('/dashboard/assessments')

  const { data: assessment } = await db
    .from('assessments')
    .select('id, title, description, role, time_limit_minutes, proctoring_config, question_order, presentation_mode')
    .eq('id', params.assessmentId)
    .eq('user_id', user.id)
    .single()

  if (!assessment) notFound()

  const { data: questions } = await db
    .from('assessment_questions')
    .select('*')
    .eq('assessment_id', params.assessmentId)
    .order('sort_order')

  return <AssessPreview assessment={assessment} questions={questions ?? []} />
}
