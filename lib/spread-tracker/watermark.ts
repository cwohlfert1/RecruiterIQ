import { createAdminClient } from '@/lib/supabase/admin'

export async function recalcWatermark(userId: string) {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data: rows } = await db
    .from('spread_placements')
    .select('weekly_spread')
    .eq('user_id', userId)
    .eq('status', 'active')

  const total = (rows ?? []).reduce((sum: number, r: { weekly_spread: number }) => sum + Number(r.weekly_spread), 0)

  const { data: existing } = await db
    .from('spread_high_watermark')
    .select('high_amount')
    .eq('user_id', userId)
    .single()

  if (!existing) {
    await db.from('spread_high_watermark').insert({ user_id: userId, high_amount: total, achieved_at: new Date().toISOString() })
  } else if (total > Number(existing.high_amount)) {
    await db.from('spread_high_watermark').update({ high_amount: total, achieved_at: new Date().toISOString() }).eq('user_id', userId)
  }
}
