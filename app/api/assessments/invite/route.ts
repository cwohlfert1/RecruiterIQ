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
    projectId?:     string
    jdText?:        string
  }

  const { assessmentId, candidateName, candidateEmail, projectId, jdText } = body

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

  // Fetch question counts for time estimate in email
  const { data: questionRows } = await db
    .from('assessment_questions')
    .select('type')
    .eq('assessment_id', assessmentId) as { data: { type: string }[] | null }

  const allQs      = questionRows ?? []
  const codingCnt  = allQs.filter(q => q.type === 'coding').length
  const mcCnt      = allQs.filter(q => q.type === 'multiple_choice').length
  const writtenCnt = allQs.filter(q => q.type === 'written').length
  const baseMin    = codingCnt * 15 + mcCnt * 2 + writtenCnt * 5
  const loMin      = Math.round(baseMin * 0.8)
  const hiMin      = Math.round(baseMin * 1.2)
  const timeRange  = baseMin > 0 ? `${loMin}–${hiMin} minutes` : 'varies'

  // Create invite
  const inviteRow: Record<string, unknown> = {
    assessment_id:   assessmentId,
    created_by:      user.id,
    candidate_name:  candidateName.trim(),
    candidate_email: candidateEmail.trim(),
    sent_at:         new Date().toISOString(),
    expires_at:      expiresAt,
  }
  // Attach project context if provided (non-breaking — column may not exist yet)
  if (projectId) inviteRow.project_id = projectId
  if (jdText) inviteRow.jd_context = jdText.slice(0, 5000)

  const { data: invite, error: inviteError } = await db
    .from('assessment_invites')
    .insert(inviteRow)
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
          ">Start Assessment →</a>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #475569; font-size: 14px; font-weight: 600; margin-bottom: 10px;">Before you begin:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #64748b; font-size: 13px;">⏱&nbsp; Set aside approximately <strong>${timeRange}</strong> of uninterrupted time</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b; font-size: 13px;">💻&nbsp; Use a desktop or laptop computer</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b; font-size: 13px;">🔇&nbsp; Find a quiet, well-lit space</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b; font-size: 13px;">📶&nbsp; Ensure a stable internet connection</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b; font-size: 13px;">🗂&nbsp; Close other browser tabs and applications</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
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
