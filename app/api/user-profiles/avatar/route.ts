import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_SIZE    = 2 * 1024 * 1024   // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// POST /api/user-profiles/avatar — upload custom avatar photo
// Accepts multipart/form-data with a 'file' field
export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File must be an image (JPEG, PNG, GIF, or WebP)' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File must be 2 MB or smaller' }, { status: 400 })
  }

  const ext      = file.type.split('/')[1].replace('jpeg', 'jpg')
  const filename = `${user.id}/${Date.now()}.${ext}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  // Upload via admin client to bypass RLS on storage
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: uploadError } = await (admin as any).storage
    .from('avatars')
    .upload(filename, buffer, {
      contentType:  file.type,
      upsert:       false,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${filename}`

  // Update user_profiles
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ avatar_url: publicUrl })
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'Profile update failed' }, { status: 500 })
  }

  return NextResponse.json({ url: publicUrl })
}
