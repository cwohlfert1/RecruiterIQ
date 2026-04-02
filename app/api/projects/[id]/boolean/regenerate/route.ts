import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic, MODEL } from '@/lib/anthropic'
import { incrementAICallCount } from '@/lib/ai-gate'
import type { ProjectActivityType } from '@/types/database'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { scope: 'mine' | 'all' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { scope } = body
  if (scope !== 'mine' && scope !== 'all') {
    return NextResponse.json({ error: 'scope must be "mine" or "all"' }, { status: 400 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title, client_name, jd_text, project_members(id, user_id, role)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!project.jd_text) return NextResponse.json({ error: 'No job description' }, { status: 400 })

  const members: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find(m => m.user_id === user.id)
  const isOwner      = project.owner_id === user.id
  const callerRole   = callerMember?.role ?? (isOwner ? 'owner' : null)

  if (!callerRole || callerRole === 'viewer') {
    return NextResponse.json({ error: 'Collaborator access required' }, { status: 403 })
  }
  if (scope === 'all' && callerRole === 'collaborator') {
    return NextResponse.json({ error: 'Manager or owner required to regenerate all' }, { status: 403 })
  }

  const targetUserIds: string[] =
    scope === 'mine'
      ? [user.id]
      : Array.from(new Set([project.owner_id, ...members.map(m => m.user_id)]))

  const n = targetUserIds.length

  // Fetch existing active strings for overlap-avoidance context (mine scope)
  let existingContext = ''
  if (scope === 'mine') {
    const { data: existing } = await supabase
      .from('project_boolean_strings')
      .select('linkedin_string, variant_type')
      .eq('project_id', params.id)
      .eq('is_active', true)
      .eq('variant_type', 'targeted')
      .neq('user_id', user.id)

    if ((existing ?? []).length > 0) {
      existingContext = `\n\nOther recruiters' active targeted strings (yours must differ meaningfully):\n${
        (existing ?? []).map((s: { linkedin_string: string }) => `- ${s.linkedin_string}`).join('\n')
      }`
    }
  }

  const prompt = `You are a Boolean search string expert for technical recruiting.

Job Title: ${project.title}
Client: ${project.client_name}

Job Description:
${project.jd_text.slice(0, 3000)}${existingContext}

Generate ${n} recruiter variation${n !== 1 ? 's' : ''}, each with TWO Boolean search strings:

VARIANT 1 — TARGETED (strict):
- Use AND logic throughout; exact title matches; all required skills ANDed
- Designed to return 50–200 results on LinkedIn

VARIANT 2 — BROAD (inclusive):
- Use OR groups for title variations; nice-to-have skills as OR alternatives
- Designed to return 500–2000 results
${scope === 'mine' ? '\nYour variation must differ meaningfully from the strings listed above.' : ''}

Return ONLY valid JSON array — no explanation, no markdown:
[
  {
    "targeted": { "linkedin_string": "...", "indeed_string": "..." },
    "broad":    { "linkedin_string": "...", "indeed_string": "..." }
  }
]`

  let variations: Array<{
    targeted: { linkedin_string: string; indeed_string: string }
    broad:    { linkedin_string: string; indeed_string: string }
  }> = []

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: scope === 'mine' ? 800 : Math.max(1200, n * 500),
      messages:   [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array')

    const parsed = JSON.parse(jsonMatch[0])
    variations = Array.isArray(parsed) ? parsed.slice(0, n) : []
    while (variations.length < n) variations.push({ ...variations[0] })
  } catch {
    return NextResponse.json({ error: 'Failed to generate variations' }, { status: 500 })
  }

  await incrementAICallCount(user.id)

  // Archive old active strings for target users
  for (const uid of targetUserIds) {
    await supabase
      .from('project_boolean_strings')
      .update({ is_active: false })
      .eq('project_id', params.id)
      .eq('user_id', uid)
      .eq('is_active', true)
  }

  // Insert targeted + broad per user
  const inserts: Array<Record<string, unknown>> = []
  for (let i = 0; i < targetUserIds.length; i++) {
    const uid = targetUserIds[i]
    const v   = variations[i]
    inserts.push({
      project_id:      params.id,
      user_id:         uid,
      linkedin_string: v.targeted.linkedin_string,
      indeed_string:   v.targeted.indeed_string,
      variant_type:    'targeted',
      is_active:       true,
      created_by:      user.id,
    })
    inserts.push({
      project_id:      params.id,
      user_id:         uid,
      linkedin_string: v.broad.linkedin_string,
      indeed_string:   v.broad.indeed_string,
      variant_type:    'broad',
      is_active:       true,
      created_by:      user.id,
    })
  }

  await supabase.from('project_boolean_strings').insert(inserts)

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await admin.from('project_activity').insert({
    project_id:    params.id,
    user_id:       user.id,
    action_type:   'boolean_regenerated' satisfies ProjectActivityType,
    metadata_json: { scope },
  })

  const myIdx = targetUserIds.indexOf(user.id)
  const myV   = variations[myIdx >= 0 ? myIdx : 0]

  return NextResponse.json({
    targeted: { linkedin_string: myV.targeted.linkedin_string, indeed_string: myV.targeted.indeed_string },
    broad:    { linkedin_string: myV.broad.linkedin_string,    indeed_string: myV.broad.indeed_string    },
  })
}
