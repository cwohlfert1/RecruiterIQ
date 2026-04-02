import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

function getResend() { return new Resend(process.env.RESEND_API_KEY ?? 'placeholder') }

function hoursRemaining(expiresAt: string): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))
}

function formatHours(hours: number): string {
  if (hours >= 48) return `${Math.floor(hours / 24)} days`
  if (hours >= 1)  return `${hours} hours`
  return 'less than 1 hour'
}

export async function POST() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Find invites: pending, sent > 24h ago, not yet expired, reminder not sent
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: invites, error } = await admin
    .from('assessment_invites')
    .select(`
      id,
      candidate_name,
      candidate_email,
      token,
      expires_at,
      assessments (
        title,
        role,
        user_id
      )
    `)
    .eq('status', 'pending')
    .eq('reminder_sent', false)
    .lte('created_at', cutoff)
    .gt('expires_at', new Date().toISOString())

  if (error) {
    console.error('send-reminders query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const toProcess = (invites ?? []) as Array<{
    id: string
    candidate_name: string
    candidate_email: string
    token: string
    expires_at: string
    assessments: { title: string; role: string; user_id: string } | null
  }>

  let sent = 0
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://candidai.app'

  // Resolve recruiter names in bulk
  const recruiterIds = Array.from(new Set(toProcess.map(i => i.assessments?.user_id).filter(Boolean))) as string[]
  const recruiterNames: Record<string, string> = {}
  await Promise.all(
    recruiterIds.map(async uid => {
      const { data } = await admin.auth.admin.getUserById(uid)
      recruiterNames[uid] = data?.user?.email?.split('@')[0] ?? 'Your recruiter'
    })
  )

  await Promise.all(
    toProcess.map(async invite => {
      const assessment = invite.assessments
      if (!assessment) return

      const link        = `${baseUrl}/assess/${invite.token}`
      const hours       = hoursRemaining(invite.expires_at)
      const recruiter   = recruiterNames[assessment.user_id] ?? 'Your recruiter'

      try {
        await getResend().emails.send({
          from:    'Candid.ai <noreply@candidai.app>',
          to:      invite.candidate_email,
          subject: `Reminder: Your ${assessment.role} assessment is waiting`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
              <h2 style="color: #1e293b;">Hi ${invite.candidate_name},</h2>
              <p>Just a friendly reminder that your <strong>${assessment.role}</strong> assessment from <strong>${recruiter}</strong> is still waiting for you.</p>
              <p>You have <strong>${formatHours(hours)}</strong> remaining to complete it.</p>
              <a href="${link}" style="
                display: inline-block;
                margin: 16px 0;
                padding: 12px 24px;
                background: linear-gradient(135deg, #6366F1, #8B5CF6);
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-weight: 600;
              ">Complete Assessment →</a>
              <p style="color: #64748b; font-size: 13px;">Or copy this link: ${link}</p>
              <p style="color: #94a3b8; font-size: 12px;">Good luck!<br/>— The Candid.ai Team</p>
            </div>
          `,
        })

        await admin
          .from('assessment_invites')
          .update({ reminder_sent: true })
          .eq('id', invite.id)

        sent++
      } catch (err) {
        console.error('Failed to send reminder to', invite.candidate_email, err)
      }
    })
  )

  return NextResponse.json({ sent, total: toProcess.length })
}
