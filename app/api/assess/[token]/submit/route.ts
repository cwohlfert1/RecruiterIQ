import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { anthropic, MODEL } from '@/lib/anthropic'
import { Resend } from 'resend'
import type { ProctoringEvent, AssessmentQuestionResponse } from '@/types/database'

function getResend() { return new Resend(process.env.RESEND_API_KEY ?? 'placeholder') }

function calculateTrustScore(events: ProctoringEvent[]): number {
  let score = 100
  for (const e of events) {
    const payload = e.payload_json as Record<string, unknown>
    switch (e.event_type) {
      case 'tab_switch': {
        const ms = typeof payload.duration_away_ms === 'number' ? payload.duration_away_ms : 0
        score -= ms > 60000 ? 20 : ms > 15000 ? 10 : 2
        break
      }
      case 'paste_detected': {
        const chars = typeof payload.char_count === 'number' ? payload.char_count : 0
        score -= chars > 500 ? 20 : chars > 100 ? 5 : 1
        break
      }
      case 'presence_challenge_failed': score -= 25; break
      case 'gaze_off_screen': {
        const ms = typeof payload.duration_ms === 'number' ? payload.duration_ms : 0
        score -= ms > 30000 ? 10 : ms > 10000 ? 5 : 0
        break
      }
      case 'keystroke_anomaly':
        score -= e.severity === 'high' ? 10 : e.severity === 'medium' ? 3 : 0
        break
      case 'automated_input_detected': score -= 30; break
      case 'code_without_typing':      score -= 25; break
      case 'face_not_detected': score -= 8; break
      case 'offline_detected':  score -= 5; break
    }
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

function calculateSkillScore(
  responses: AssessmentQuestionResponse[],
  questionPoints: Record<string, number>
): number {
  let total  = 0
  let earned = 0
  for (const r of responses) {
    const max = questionPoints[r.question_id] ?? 100
    total  += max
    if (r.skill_score !== null) earned += (r.skill_score / 100) * max
  }
  return total === 0 ? 0 : Math.round((earned / total) * 100)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin     = createAdminClient() as any
  const { token } = params

  // Security: verify token is valid, in-progress, AND not expired
  const { data: invite } = await admin
    .from('assessment_invites')
    .select('id, assessment_id, created_by, candidate_name, candidate_email, expires_at')
    .eq('token', token)
    .eq('status', 'started')
    .single() as { data: { id: string; assessment_id: string; created_by: string; candidate_name: string; candidate_email: string; expires_at: string | null } | null }

  if (!invite) return NextResponse.json({ error: 'Invalid token' }, { status: 403 })

  // Reject submissions on expired invites
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Assessment has expired' }, { status: 410 })
  }

  const { data: session } = await admin
    .from('assessment_sessions')
    .select('id, started_at')
    .eq('invite_id', invite.id)
    .eq('status', 'in_progress')
    .single() as { data: { id: string; started_at: string } | null }

  if (!session) return NextResponse.json({ error: 'No active session' }, { status: 403 })

  const body = await req.json() as {
    responses: Array<{
      questionId:     string
      answerText?:    string
      selectedOption?: string
    }>
    timeSpentSeconds: number
  }

  const completedAt = new Date().toISOString()

  // Grade MC questions automatically
  const { data: questions } = await admin
    .from('assessment_questions')
    .select('id, type, correct_option, points')
    .eq('assessment_id', invite.assessment_id)

  const questionMap: Record<string, { type: string; correct_option: string | null; points: number }> = {}
  for (const q of (questions ?? [])) {
    questionMap[q.id] = q
  }

  // Save responses with auto-scoring for MC
  const responseRows = body.responses.map(r => {
    const q = questionMap[r.questionId]
    let skillScore: number | null = null
    let feedbackJson: Record<string, unknown> | null = null

    if (q?.type === 'multiple_choice' && r.selectedOption) {
      skillScore   = r.selectedOption === q.correct_option ? 100 : 0
      feedbackJson = { auto_scored: true }
    }

    return {
      session_id:      session.id,
      question_id:     r.questionId,
      answer_text:     r.answerText ?? null,
      selected_option: r.selectedOption ?? null,
      skill_score:     skillScore,
      feedback_json:   feedbackJson,
      graded_at:       skillScore !== null ? completedAt : null,
      saved_at:        completedAt,
    }
  })

  await admin.from('assessment_question_responses').upsert(responseRows, {
    onConflict: 'session_id,question_id',
  })

  // Fetch events + responses for scoring
  const [eventsRes, savedResponsesRes] = await Promise.all([
    admin.from('proctoring_events').select('*').eq('session_id', session.id),
    admin.from('assessment_question_responses').select('*').eq('session_id', session.id),
  ])

  const events    = (eventsRes.data    ?? []) as ProctoringEvent[]
  const responses = (savedResponsesRes.data ?? []) as AssessmentQuestionResponse[]

  const questionPoints: Record<string, number> = {}
  for (const q of (questions ?? [])) questionPoints[q.id] = q.points

  const trustScore = calculateTrustScore(events)
  const skillScore = calculateSkillScore(responses, questionPoints)

  // Generate AI integrity summary
  const eventSummary = events.length > 0
    ? events.map(e => `${e.event_type} (${e.severity}): ${JSON.stringify(e.payload_json)}`).join('\n')
    : 'No proctoring events.'

  let aiSummary = ''
  try {
    const msg = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 250,
      messages: [{
        role: 'user',
        content: `Write exactly 3 sentences summarizing this candidate's integrity in a proctored assessment. Be factual and professional.

Candidate: ${invite.candidate_name}
Trust Score: ${trustScore}/100
Events:\n${eventSummary}

3 sentences only, no headers.`,
      }],
    })
    aiSummary = (msg.content[0] as { text: string }).text.trim()
  } catch {
    aiSummary = `${invite.candidate_name} completed the assessment with a trust score of ${trustScore}/100. ${events.length} proctoring event(s) were recorded. Detailed event logs are available in the proctoring timeline.`
  }

  // Mark session completed
  await admin.from('assessment_sessions').update({
    status:               'completed',
    completed_at:         completedAt,
    time_spent_seconds:   body.timeSpentSeconds,
    trust_score:          trustScore,
    skill_score:          skillScore,
    ai_integrity_summary: aiSummary,
  }).eq('id', session.id)

  // Mark invite completed
  await admin.from('assessment_invites').update({ status: 'completed' }).eq('id', invite.id)

  // Create in-app notification
  const { data: assessment } = await admin
    .from('assessments')
    .select('title, id, template_type, notification_recipients')
    .eq('id', invite.assessment_id)
    .single() as { data: { title: string; id: string; template_type: string | null; notification_recipients: Array<{ email: string; name: string; user_id?: string | null }> | null } | null }

  // Upsert benchmark scores for this template_type
  if (assessment?.template_type) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('assessment_benchmarks')
      .select('avg_skill_score, avg_trust_score, total_assessments')
      .eq('template_type', assessment.template_type)
      .single() as { data: { avg_skill_score: number; avg_trust_score: number; total_assessments: number } | null }

    if (existing) {
      const n = existing.total_assessments
      await (admin as any).from('assessment_benchmarks').update({
        avg_skill_score:   ((existing.avg_skill_score * n) + skillScore)  / (n + 1),
        avg_trust_score:   ((existing.avg_trust_score  * n) + trustScore) / (n + 1),
        total_assessments: n + 1,
        updated_at:        new Date().toISOString(),
      }).eq('template_type', assessment.template_type)
    } else {
      await (admin as any).from('assessment_benchmarks').insert({
        template_type:     assessment.template_type,
        avg_skill_score:   skillScore,
        avg_trust_score:   trustScore,
        total_assessments: 1,
      })
    }
  }

  const reportUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/assessments/${invite.assessment_id}/report/${session.id}`

  // In-app notification to assessment owner
  await admin.from('notifications').insert({
    user_id: invite.created_by,
    type:    'assessment_completed',
    title:   `${invite.candidate_name} completed an assessment`,
    message: `${assessment?.title ?? 'Assessment'} — Trust: ${trustScore} | Skill: ${skillScore}`,
    link:    reportUrl,
    read:    false,
  })

  const notificationHtml = (toName: string) => `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h2>${invite.candidate_name} completed: ${assessment?.title}</h2>
      <p>Hi ${toName},</p>
      <p><strong>Trust Score:</strong> ${trustScore}/100</p>
      <p><strong>Skill Score:</strong> ${skillScore}/100</p>
      <p>${aiSummary}</p>
      <a href="${reportUrl}"
         style="display:inline-block;margin:16px 0;padding:12px 24px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:white;text-decoration:none;border-radius:10px;font-weight:600;">
        View Full Report
      </a>
    </div>
  `

  const subject = `${invite.candidate_name} completed their assessment`

  // Notify recruiter via email
  const { data: recruiterProfile } = await admin.auth.admin.getUserById(invite.created_by)
  const recruiterEmail = recruiterProfile.user?.email

  const emailsToSend: Array<{ to: string; toName: string }> = []
  if (recruiterEmail) emailsToSend.push({ to: recruiterEmail, toName: 'there' })

  // Additional notification recipients
  const extraRecipients = assessment?.notification_recipients ?? []
  for (const r of extraRecipients) {
    if (r.email && r.email !== recruiterEmail) {
      emailsToSend.push({ to: r.email, toName: r.name })
      // Also send in-app notification if they have a user_id
      if (r.user_id) {
        await admin.from('notifications').insert({
          user_id: r.user_id,
          type:    'assessment_completed',
          title:   `${invite.candidate_name} completed an assessment`,
          message: `${assessment?.title ?? 'Assessment'} — Trust: ${trustScore} | Skill: ${skillScore}`,
          link:    reportUrl,
          read:    false,
        }).catch(() => null)
      }
    }
  }

  await Promise.allSettled(
    emailsToSend.map(({ to, toName }) =>
      getResend().emails.send({
        from:    'Candid.ai <noreply@candidai.app>',
        to,
        subject,
        html: notificationHtml(toName),
      }).catch(() => console.error('Failed to send notification to', to))
    )
  )

  return NextResponse.json({ ok: true, trustScore, skillScore })
}
