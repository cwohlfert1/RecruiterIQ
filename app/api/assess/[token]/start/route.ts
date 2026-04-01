import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { token } = params

  // Validate token
  const { data: invite } = await admin
    .from('assessment_invites')
    .select('id, assessment_id, created_by, candidate_name, status, expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!invite || !['pending', 'started'].includes(invite.status)) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  const { data: assessment } = await admin
    .from('assessments')
    .select('title, description, role, time_limit_minutes, question_display, proctoring_config')
    .eq('id', invite.assessment_id)
    .single()

  const { data: questions } = await admin
    .from('assessment_questions')
    .select('*')
    .eq('assessment_id', invite.assessment_id)
    .order('sort_order')

  // Create or find existing session
  let sessionId: string

  const { data: existingSession } = await admin
    .from('assessment_sessions')
    .select('id')
    .eq('invite_id', invite.id)
    .maybeSingle()

  if (existingSession) {
    sessionId = existingSession.id
  } else {
    const { data: newSession, error } = await admin
      .from('assessment_sessions')
      .insert({
        invite_id:     invite.id,
        assessment_id: invite.assessment_id,
        user_id:       invite.created_by,
        status:        'in_progress',
      })
      .select('id')
      .single()

    if (error || !newSession) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }
    sessionId = newSession.id

    // Update invite status to started
    await admin
      .from('assessment_invites')
      .update({ status: 'started' })
      .eq('id', invite.id)
  }

  return NextResponse.json({
    sessionId,
    assessment,
    questions: questions ?? [],
    candidateName: invite.candidate_name,
  })
}
