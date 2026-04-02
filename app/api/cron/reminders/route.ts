import { NextRequest, NextResponse } from 'next/server'

// Called by a cron scheduler (Railway, GitHub Actions, etc.)
// Set CRON_SECRET in environment variables and pass it as the Authorization header.
// Example: Authorization: Bearer <CRON_SECRET>
// Example cron: 0 10 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://candidai.app/api/cron/reminders

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Call the send-reminders endpoint internally
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://candidai.app'
  const res = await fetch(`${baseUrl}/api/assessments/send-reminders`, { method: 'POST' })
  const json = await res.json()

  return NextResponse.json({ ok: true, ...json })
}
