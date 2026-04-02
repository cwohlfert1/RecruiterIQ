import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// GET /api/projects/[id]/candidates/[candidateId]/resume
// Returns a short-lived signed URL for the candidate's original resume file.

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; candidateId: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Verify project membership and get resume_file_url
  const { data: candidate } = await supabase
    .from('project_candidates')
    .select('id, resume_file_url, candidate_name, project_id')
    .eq('id', params.candidateId)
    .eq('project_id', params.id)
    .is('deleted_at', null)
    .single()

  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!candidate.resume_file_url) return NextResponse.json({ error: 'No file stored' }, { status: 404 })

  // Generate signed URL with service role (1 hour expiry)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await admin.storage
    .from('resumes')
    .createSignedUrl(candidate.resume_file_url, 3600)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
