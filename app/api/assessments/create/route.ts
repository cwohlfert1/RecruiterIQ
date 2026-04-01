import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AssessmentDraft } from '@/components/assessments/assessment-builder'

export async function POST(req: NextRequest) {
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

  const body = await req.json() as { draft: AssessmentDraft; status: 'draft' | 'published' }
  const { draft, status } = body

  if (!draft || !status) {
    return NextResponse.json({ error: 'draft and status are required' }, { status: 400 })
  }

  if (!draft.title?.trim() || !draft.role?.trim()) {
    return NextResponse.json({ error: 'Title and role are required' }, { status: 400 })
  }
  if (draft.questions.length === 0) {
    return NextResponse.json({ error: 'At least one question is required' }, { status: 400 })
  }

  // Insert assessment
  const { data: assessment, error: assessmentError } = await db
    .from('assessments')
    .insert({
      user_id:            user.id,
      title:              draft.title.trim(),
      description:        draft.description?.trim() || null,
      role:               draft.role.trim(),
      time_limit_minutes: draft.time_limit_enabled ? draft.time_limit_minutes : 60,
      proctoring_config:  draft.proctoring,
      question_order:     draft.question_order,
      presentation_mode:  draft.presentation_mode,
      status,
    })
    .select()
    .single()

  if (assessmentError || !assessment) {
    return NextResponse.json({ error: assessmentError?.message ?? 'Failed to create assessment' }, { status: 500 })
  }

  // Insert questions
  const questionRows = draft.questions.map(q => ({
    assessment_id:   assessment.id,
    type:            q.type,
    prompt:          q.prompt,
    points:          q.points,
    sort_order:      q.sort_order,
    language:        q.language ?? null,
    starter_code:    q.starter_code ?? null,
    test_cases_json: q.test_cases ?? null,
    instructions:    q.instructions ?? null,
    options_json:    q.options ?? null,
    correct_option:  q.correct_option ?? null,
    length_hint:     q.length_hint ?? null,
    rubric_hints:    q.rubric_hints ?? null,
  }))

  const { error: questionsError } = await db
    .from('assessment_questions')
    .insert(questionRows)

  if (questionsError) {
    // Roll back assessment
    await db.from('assessments').delete().eq('id', assessment.id)
    return NextResponse.json({ error: questionsError.message }, { status: 500 })
  }

  // When publishing, create a generic shareable invite and return its token
  let token: string | null = null
  if (status === 'published') {
    const { data: invite, error: inviteError } = await db
      .from('assessment_invites')
      .insert({
        assessment_id:   assessment.id,
        created_by:      user.id,
        candidate_name:  'Open Link',
        candidate_email: 'open@recruiteriq.app',
      })
      .select('token')
      .single()

    if (inviteError) {
      // Assessment was created — don't roll back, just return without token
      return NextResponse.json({ id: assessment.id, status, token: null })
    }
    token = invite.token
  }

  return NextResponse.json({ id: assessment.id, status, token })
}
