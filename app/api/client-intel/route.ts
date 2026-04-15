import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const client = req.nextUrl.searchParams.get('client')
  if (!client) return NextResponse.json({ error: 'client param required' }, { status: 400 })

  const { data } = await supabase
    .from('client_intel')
    .select('outcome_count, avg_cqi_placed, avg_cqi_rejected, success_threshold, catfish_patterns')
    .eq('user_id', user.id)
    .eq('client_company', client)
    .single()

  if (!data || data.outcome_count < 3) {
    return NextResponse.json({ intel: null })
  }

  return NextResponse.json({ intel: data })
}
