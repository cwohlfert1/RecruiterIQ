import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/linkedin/disconnect
export async function POST() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { error } = await supabase
    .from('user_profiles')
    .update({
      linkedin_id:           null,
      linkedin_url:          null,
      linkedin_connected_at: null,
    })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })

  return NextResponse.json({ success: true })
}
