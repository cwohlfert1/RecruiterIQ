import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import type { ProjectActivityType } from '@/types/database'

const PLAN_LIMITS: Record<string, number> = {
  free:   0,
  pro:    2,
  agency: Infinity,
}

// ─── GET: return team members available to add ────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Get existing project members (to exclude)
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, project_members(user_id)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existingIds = new Set<string>([
    project.owner_id,
    ...(project.project_members ?? []).map((m: { user_id: string }) => m.user_id),
  ])

  // Get caller's team members (accepted, with a linked account)
  const { data: teamRows } = await supabase
    .from('team_members')
    .select('member_user_id, invited_email')
    .eq('owner_user_id', user.id)
    .eq('status', 'active')
    .not('member_user_id', 'is', null)

  const available = (teamRows ?? [])
    .filter((m: { member_user_id: string | null }) => m.member_user_id && !existingIds.has(m.member_user_id))
    .map((m: { member_user_id: string; invited_email: string }) => ({
      user_id: m.member_user_id,
      email:   m.invited_email,
    }))

  return NextResponse.json({ members: available })
}

// ─── POST: share project with selected members ────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { members: Array<{ user_id: string; role: 'collaborator' | 'viewer' }> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.members?.length) {
    return NextResponse.json({ error: 'No members specified' }, { status: 400 })
  }

  // Fetch project + caller's plan in parallel
  const [projectRes, profileRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, owner_id, title, client_name, project_members(user_id, role)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('user_profiles')
      .select('plan_tier')
      .eq('user_id', user.id)
      .single(),
  ])

  if (!projectRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const project       = projectRes.data
  const existingMembers: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const isOwner       = project.owner_id === user.id
  const callerMember  = existingMembers.find(m => m.user_id === user.id)
  const callerRole    = callerMember?.role ?? (isOwner ? 'owner' : null)

  if (callerRole !== 'owner') {
    return NextResponse.json({ error: 'Owner access required to share' }, { status: 403 })
  }

  const planTier = profileRes.data?.plan_tier ?? 'free'
  const limit    = PLAN_LIMITS[planTier] ?? 0

  if (limit === 0) {
    return NextResponse.json({ error: 'Upgrade your plan to share projects', code: 'plan_required' }, { status: 403 })
  }

  if (isFinite(limit) && existingMembers.length + body.members.length > limit) {
    return NextResponse.json({
      error: `Your plan allows up to ${limit} member${limit !== 1 ? 's' : ''} per project`,
      code: 'limit_reached',
    }, { status: 403 })
  }

  // Insert new project_members
  const rows = body.members.map(m => ({
    project_id: params.id,
    user_id:    m.user_id,
    role:       m.role,
    added_by:   user.id,
  }))

  const { error: insertError } = await supabase
    .from('project_members')
    .insert(rows)

  if (insertError) {
    return NextResponse.json({ error: 'Failed to add members' }, { status: 500 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sharerData } = await admin.auth.admin.getUserById(user.id)
  const sharerEmail = sharerData?.user?.email ?? 'A team member'
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://candidai.app'
  const projectLink = `${appUrl}/dashboard/projects/${params.id}`
  const resend      = new Resend(process.env.RESEND_API_KEY ?? 'placeholder')

  for (const m of body.members) {
    // In-app notification
    await admin.from('notifications').insert({
      user_id: m.user_id,
      type:    'project_shared',
      title:   `${sharerEmail} shared a project with you`,
      message: `You've been added to "${project.title}" for ${project.client_name}`,
      link:    projectLink,
    })

    // Email
    const { data: recipientData } = await admin.auth.admin.getUserById(m.user_id)
    const recipientEmail = recipientData?.user?.email
    if (recipientEmail) {
      try {
        await resend.emails.send({
          from:    'Candid.ai <noreply@candidai.app>',
          to:      recipientEmail,
          subject: `${sharerEmail} invited you to a Candid.ai project`,
          html: `
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b;">
              <h2 style="margin-bottom: 8px;">You've been added to a project</h2>
              <p><strong>${sharerEmail}</strong> invited you to collaborate on
              <strong>${project.title}</strong> for <strong>${project.client_name}</strong>.</p>
              <a href="${projectLink}" style="
                display: inline-block; margin: 16px 0; padding: 12px 24px;
                background: linear-gradient(135deg, #6366F1, #8B5CF6);
                color: white; text-decoration: none; border-radius: 10px; font-weight: 600;
              ">View Project</a>
              <p style="color: #64748b; font-size: 13px;">Or copy: ${projectLink}</p>
            </div>
          `,
        })
      } catch {
        // Email failure doesn't block share
      }
    }
  }

  // Log activity
  await admin.from('project_activity').insert({
    project_id:    params.id,
    user_id:       user.id,
    action_type:   'project_shared' satisfies ProjectActivityType,
    metadata_json: { count: body.members.length },
  })

  return NextResponse.json({ success: true, added: body.members.length })
}
