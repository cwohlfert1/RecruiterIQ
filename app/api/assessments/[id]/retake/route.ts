import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

function getResend() { return new Resend(process.env.RESEND_API_KEY ?? 'placeholder') }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  // Verify assessment belongs to this manager and allows retakes
  const { data: assessment } = await db
    .from('assessments')
    .select('id, title, role, allow_retakes, expiry_hours')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!assessment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!assessment.allow_retakes) {
    return NextResponse.json({ error: 'This assessment does not allow retakes' }, { status: 400 })
  }

  const body = await req.json() as { inviteId: string }
  const { inviteId } = body
  if (!inviteId) return NextResponse.json({ error: 'inviteId required' }, { status: 400 })

  // Fetch original invite
  const { data: originalInvite } = await db
    .from('assessment_invites')
    .select('id, candidate_name, candidate_email, status')
    .eq('id', inviteId)
    .eq('assessment_id', params.id)
    .single()

  if (!originalInvite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  if (originalInvite.status !== 'completed') {
    return NextResponse.json({ error: 'Candidate has not completed this assessment yet' }, { status: 400 })
  }

  // Check 24-hour cooldown (find most recent completed session for this invite)
  const { data: lastSession } = await db
    .from('assessment_sessions')
    .select('completed_at')
    .eq('invite_id', inviteId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  if (lastSession?.completed_at) {
    const hoursSince = (Date.now() - new Date(lastSession.completed_at).getTime()) / (1000 * 60 * 60)
    if (hoursSince < 24) {
      const availableAt = new Date(new Date(lastSession.completed_at).getTime() + 24 * 60 * 60 * 1000)
      return NextResponse.json({
        error: `Candidate must wait 24 hours between attempts. Available at ${availableAt.toLocaleString()}.`,
      }, { status: 400 })
    }
  }

  const expiryHours = (assessment.expiry_hours as number | null) ?? 48
  const expiresAt   = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()

  // Create new invite
  const { data: newInvite, error: inviteError } = await db
    .from('assessment_invites')
    .insert({
      assessment_id:   params.id,
      created_by:      user.id,
      candidate_name:  originalInvite.candidate_name,
      candidate_email: originalInvite.candidate_email,
      sent_at:         new Date().toISOString(),
      expires_at:      expiresAt,
    })
    .select('token')
    .single()

  if (inviteError || !newInvite) {
    return NextResponse.json({ error: inviteError?.message ?? 'Failed to create retake invite' }, { status: 500 })
  }

  const baseUrl       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://candidai.app'
  const candidateLink = `${baseUrl}/assess/${newInvite.token}`

  // Send email to candidate
  try {
    await getResend().emails.send({
      from:    'Candid.ai <noreply@candidai.app>',
      to:      originalInvite.candidate_email,
      subject: `You've been given a retake opportunity: ${assessment.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
          <h2>Hi ${originalInvite.candidate_name},</h2>
          <p>You've been granted a retake for the <strong>${assessment.role}</strong> assessment.</p>
          <p>Your previous results have been saved. This is a fresh attempt.</p>
          <a href="${candidateLink}" style="
            display: inline-block;
            margin: 16px 0;
            padding: 12px 24px;
            background: linear-gradient(135deg, #6366F1, #8B5CF6);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
          ">Start Retake →</a>
          <p style="color: #64748b; font-size: 13px;">Good luck!<br/>— The Candid.ai Team</p>
        </div>
      `,
    })
  } catch {
    console.error('Failed to send retake email')
  }

  return NextResponse.json({ ok: true, token: newInvite.token })
}
