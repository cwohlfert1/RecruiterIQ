import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const admin     = createAdminClient()
  const { token } = params

  // Validate token + snapshots enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inviteRaw } = await (admin as any)
    .from('assessment_invites')
    .select('id, assessment_id')
    .eq('token', token)
    .eq('status', 'started')
    .single()

  const invite = inviteRaw as { id: string; assessment_id: string } | null
  if (!invite) return NextResponse.json({ error: 'Invalid token' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assessmentRaw } = await (admin as any)
    .from('assessments')
    .select('proctoring_config')
    .eq('id', invite.assessment_id)
    .single()

  const assessment = assessmentRaw as { proctoring_config: Record<string, unknown> | null } | null
  const config = assessment?.proctoring_config
  if (!config?.snapshots) {
    return NextResponse.json({ error: 'Snapshots not enabled for this assessment' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessionRaw } = await (admin as any)
    .from('assessment_sessions')
    .select('id')
    .eq('invite_id', invite.id)
    .eq('status', 'in_progress')
    .single()

  const session = sessionRaw as { id: string } | null
  if (!session) return NextResponse.json({ error: 'No active session' }, { status: 403 })

  const body = await req.json() as { image: string } // base64 data URL
  if (!body.image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  // Convert base64 to buffer
  const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '')
  const buffer     = Buffer.from(base64Data, 'base64')

  const timestamp  = Date.now()
  const path       = `${session.id}/${timestamp}.jpg`

  const { error: uploadError } = await admin.storage
    .from('assessment-snapshots')
    .upload(path, buffer, {
      contentType: 'image/jpeg',
      upsert:      false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('assessment_snapshots').insert({
    session_id:   session.id,
    invite_id:    invite.id,
    storage_path: path,
    taken_at:     new Date(timestamp).toISOString(),
  })

  return NextResponse.json({ ok: true, path })
}
