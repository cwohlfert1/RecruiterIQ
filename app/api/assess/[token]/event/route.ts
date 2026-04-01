import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProctoringEventType } from '@/types/database'

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const admin   = createAdminClient()
  const { token } = params

  // Validate token → active session
  const { data: inviteData } = await admin
    .from('assessment_invites')
    .select('id')
    .eq('token', token)
    .eq('status', 'started')
    .single()

  const invite = inviteData as { id: string } | null
  if (!invite) return NextResponse.json({ error: 'Invalid token' }, { status: 403 })

  const { data: sessionData } = await admin
    .from('assessment_sessions')
    .select('id')
    .eq('invite_id', invite.id)
    .eq('status', 'in_progress')
    .single()

  const session = sessionData as { id: string } | null
  if (!session) return NextResponse.json({ error: 'No active session' }, { status: 403 })

  const body = await req.json() as {
    event_type:   ProctoringEventType
    severity:     'low' | 'medium' | 'high' | 'info'
    payload_json: Record<string, unknown>
    timestamp?:   string
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('proctoring_events').insert({
    session_id:   session.id,
    event_type:   body.event_type,
    severity:     body.severity,
    payload_json: body.payload_json ?? {},
    timestamp:    body.timestamp ?? new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
