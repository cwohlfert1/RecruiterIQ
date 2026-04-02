import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
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

  const body = await req.json() as {
    assessmentId:   string
    candidateName:  string
    candidateEmail: string
  }

  const { assessmentId, candidateName, candidateEmail } = body

  if (!assessmentId || !candidateName?.trim() || !candidateEmail?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify assessment belongs to this manager
  const { data: assessment } = await db
    .from('assessments')
    .select('id, title, role, status, expiry_hours')
    .eq('id', assessmentId)
    .eq('user_id', user.id)
    .single()

  if (!assessment) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
  if (assessment.status !== 'published') {
    return NextResponse.json({ error: 'Assessment must be published to send invites' }, { status: 400 })
  }

  const expiryHours = (assessment.expiry_hours as number | null) ?? 48
  const expiresAt   = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString()

  // Create invite
  const { data: invite, error: inviteError } = await db
    .from('assessment_invites')
    .insert({
      assessment_id:   assessmentId,
      created_by:      user.id,
      candidate_name:  candidateName.trim(),
      candidate_email: candidateEmail.trim(),
      sent_at:         new Date().toISOString(),
      expires_at:      expiresAt,
    })
    .select()
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: inviteError?.message ?? 'Failed to create invite' }, { status: 500 })
  }

  const candidateLink = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://candidai.app'}/assess/${invite.token}`

  // Send email via Resend
  try {
    await resend.emails.send({
      from:    'Candid.ai <noreply@candidai.app>',
      to:      candidateEmail.trim(),
      subject: `You've been invited to complete an assessment: ${assessment.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Hi ${candidateName},</h2>
          <p>You've been invited to complete a skills assessment for the <strong>${assessment.role}</strong> role.</p>
          <p><strong>Assessment:</strong> ${assessment.title}</p>
          <p>Click the link below to begin. The link expires in ${expiryHours < 48 ? `${expiryHours} hours` : expiryHours === 168 ? '7 days' : `${expiryHours / 24} days`}.</p>
          <a href="${candidateLink}" style="
            display: inline-block;
            margin: 16px 0;
            padding: 12px 24px;
            background: linear-gradient(135deg, #6366F1, #8B5CF6);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
          ">Start Assessment</a>
          <p style="color: #64748b; font-size: 13px;">Or copy this link: ${candidateLink}</p>
        </div>
      `,
    })
  } catch {
    // Email failure shouldn't fail the invite creation — log and continue
    console.error('Resend email failed for invite', invite.id)
  }

  return NextResponse.json({ id: invite.id, token: invite.token, link: candidateLink })
}
