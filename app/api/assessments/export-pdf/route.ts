import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PDF generation is a post-MVP feature requiring puppeteer or react-pdf.
// For now, return a plain text report as a downloadable .txt file.
// Replace with actual PDF generation when ready.

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { sessionId, assessmentId } = await req.json() as {
    sessionId:    string
    assessmentId: string
  }

  const [sessionRes, assessmentRes, inviteRes, eventsRes, responsesRes] = await Promise.all([
    db.from('assessment_sessions').select('*').eq('id', sessionId).eq('user_id', user.id).single(),
    db.from('assessments').select('*').eq('id', assessmentId).eq('user_id', user.id).single(),
    db.from('assessment_invites').select('candidate_name, candidate_email').eq('id', sessionId).maybeSingle(),
    db.from('proctoring_events').select('*').eq('session_id', sessionId).order('timestamp'),
    db.from('assessment_question_responses').select('*').eq('session_id', sessionId),
  ])

  const session    = sessionRes.data
  const assessment = assessmentRes.data

  if (!session || !assessment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const candidateName  = inviteRes.data?.candidate_name  ?? 'Candidate'
  const candidateEmail = inviteRes.data?.candidate_email ?? ''
  const events         = eventsRes.data   ?? []
  const responses      = responsesRes.data ?? []

  const lines: string[] = [
    '═══════════════════════════════════════════════',
    'RECRUITERIQ PROCTORING REPORT',
    '═══════════════════════════════════════════════',
    '',
    `Candidate:    ${candidateName}`,
    `Email:        ${candidateEmail}`,
    `Assessment:   ${assessment.title}`,
    `Role:         ${assessment.role}`,
    `Completed:    ${session.completed_at ? new Date(session.completed_at).toLocaleString() : 'N/A'}`,
    `Time Spent:   ${session.time_spent_seconds ? `${Math.floor(session.time_spent_seconds / 60)}m ${session.time_spent_seconds % 60}s` : 'N/A'}`,
    '',
    '─── SCORES ────────────────────────────────────',
    `Trust Score:  ${session.trust_score ?? 'N/A'}/100`,
    `Skill Score:  ${session.skill_score ?? 'N/A'}/100`,
    '',
    '─── AI INTEGRITY SUMMARY ──────────────────────',
    session.ai_integrity_summary ?? 'Not generated.',
    '',
    '─── PROCTORING EVENTS ─────────────────────────',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...events.map((e: any) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.event_type} (${e.severity}): ${JSON.stringify(e.payload_json)}`),
    '',
    '─── QUESTION RESPONSES ────────────────────────',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...responses.map((r: any) => `Question ${r.question_id}: Score ${r.skill_score ?? 'N/A'}/100`),
    '',
    `Generated: ${new Date().toLocaleString()}`,
    '═══════════════════════════════════════════════',
  ]

  const content = lines.join('\n')
  return new NextResponse(content, {
    headers: {
      'Content-Type':        'text/plain',
      'Content-Disposition': `attachment; filename="report-${candidateName.replace(/\s+/g, '-')}.txt"`,
    },
  })
}
