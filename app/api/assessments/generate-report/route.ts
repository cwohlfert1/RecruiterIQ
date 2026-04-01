import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import type { ProctoringEvent, AssessmentQuestionResponse } from '@/types/database'

// ── Trust score calculation ──────────────────────────────────

function calculateTrustScore(events: ProctoringEvent[]): number {
  let score = 100

  for (const e of events) {
    const payload = e.payload_json as Record<string, unknown>

    switch (e.event_type) {
      case 'tab_switch': {
        const ms = typeof payload.duration_away_ms === 'number' ? payload.duration_away_ms : 0
        if (ms > 60000) score -= 20
        else if (ms > 15000) score -= 10
        else score -= 2
        break
      }
      case 'paste_detected': {
        const chars = typeof payload.char_count === 'number' ? payload.char_count : 0
        if (chars > 500) score -= 20
        else if (chars > 100) score -= 5
        else score -= 1
        break
      }
      case 'presence_challenge_failed':
        score -= 25
        break
      case 'gaze_off_screen': {
        const ms = typeof payload.duration_ms === 'number' ? payload.duration_ms : 0
        if (ms > 30000) score -= 10
        else if (ms > 10000) score -= 5
        break
      }
      case 'keystroke_anomaly':
        if (e.severity === 'high') score -= 10
        else if (e.severity === 'medium') score -= 3
        break
      case 'face_not_detected':
        score -= 8
        break
      case 'offline_detected':
        score -= 5
        break
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ── Skill score calculation ──────────────────────────────────

function calculateSkillScore(
  responses: AssessmentQuestionResponse[],
  questionPoints: Record<string, number>
): number {
  let totalPoints   = 0
  let earnedPoints  = 0

  for (const r of responses) {
    const maxPts = questionPoints[r.question_id] ?? 100
    totalPoints += maxPts
    if (r.skill_score !== null) {
      earnedPoints += (r.skill_score / 100) * maxPts
    }
  }

  if (totalPoints === 0) return 0
  return Math.round((earnedPoints / totalPoints) * 100)
}

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

  const { sessionId, assessmentId } = await req.json() as {
    sessionId:    string
    assessmentId: string
  }

  // Verify ownership
  const { data: session } = await db
    .from('assessment_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('assessment_id', assessmentId)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const [eventsRes, responsesRes, questionsRes] = await Promise.all([
    db.from('proctoring_events').select('*').eq('session_id', sessionId),
    db.from('assessment_question_responses').select('*').eq('session_id', sessionId),
    db.from('assessment_questions').select('id, points').eq('assessment_id', assessmentId),
  ])

  const events    = eventsRes.data    ?? []
  const responses = responsesRes.data ?? []
  const questions = questionsRes.data ?? []

  const questionPoints: Record<string, number> = {}
  for (const q of questions) questionPoints[q.id] = q.points

  const trustScore = calculateTrustScore(events as ProctoringEvent[])
  const skillScore = calculateSkillScore(responses as AssessmentQuestionResponse[], questionPoints)

  // Generate AI integrity summary
  const eventSummary = events.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? events.map((e: any) => `- ${e.event_type} (${e.severity}): ${JSON.stringify(e.payload_json)}`).join('\n')
    : 'No proctoring events recorded.'

  const { data: invite } = await db
    .from('assessment_invites')
    .select('candidate_name')
    .eq('id', session.invite_id)
    .single()

  const candidateName = invite?.candidate_name ?? 'The candidate'

  let aiSummary = ''
  try {
    const message = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are reviewing a proctored technical assessment. Write exactly 3 sentences summarizing the candidate's integrity. Be factual, professional, and concise.

Candidate: ${candidateName}
Trust Score: ${trustScore}/100
Proctoring Events:
${eventSummary}

Write 3 sentences. No headers, no bullet points.`,
      }],
    })
    aiSummary = (message.content[0] as { type: string; text: string }).text.trim()
  } catch {
    aiSummary = `${candidateName} completed the assessment with a trust score of ${trustScore}/100. ${events.length} proctoring event(s) were recorded during the session. Review the detailed proctoring timeline for more information.`
  }

  // Update session
  const { error: updateError } = await db
    .from('assessment_sessions')
    .update({
      trust_score:          trustScore,
      skill_score:          skillScore,
      ai_integrity_summary: aiSummary,
      status:               'completed',
    })
    .eq('id', sessionId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ trustScore, skillScore, aiSummary })
}
