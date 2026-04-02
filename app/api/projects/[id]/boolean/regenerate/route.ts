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

  // Fetch project
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

  // Determine which user IDs to regenerate for
  const targetUserIds: string[] =
    scope === 'mine'
      ? [user.id]
      : Array.from(new Set([project.owner_id, ...members.map(m => m.user_id)]))

  const n = targetUserIds.length

  // Fetch existing active strings as overlap-avoidance context (for 'mine' scope)
  let existingContext = ''
  if (scope === 'mine') {
    const { data: existing } = await supabase
      .from('project_boolean_strings')
      .select('linkedin_string')
      .eq('project_id', params.id)
      .eq('is_active', true)
      .neq('user_id', user.id)

    if ((existing ?? []).length > 0) {
      existingContext = `\n\nOther recruiters' active strings (yours must differ meaningfully):\n${
        (existing ?? []).map((s: { linkedin_string: string }) => `- ${s.linkedin_string}`).join('\n')
      }`
    }
  }

  const prompt = `You are a Boolean search string expert for technical recruiting.

Job Title: ${project.title}
Client: ${project.client_name}

Job Description:
${project.jd_text.slice(0, 3000)}${existingContext}

Generate ${n} unique Boolean search string variation${n !== 1 ? 's' : ''}.
Each must use different combinations of title synonyms, skill permutations, seniority expressions, and exclusion terms.
${scope === 'mine' ? 'Your variation must differ meaningfully from the strings listed above.' : ''}

Return ONLY valid JSON array, no explanation:
[
  {
    "linkedin_string": "...",
    "indeed_string": "..."
  }
]`

  let variations: Array<{ linkedin_string: string; indeed_string: string }> = []

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: scope === 'mine' ? 500 : Math.max(800, n * 300),
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

  // Insert new active strings
  const inserts = targetUserIds.map((uid, i) => ({
    project_id:      params.id,
    user_id:         uid,
    linkedin_string: variations[i].linkedin_string,
    indeed_string:   variations[i].indeed_string,
    is_active:       true,
    created_by:      user.id,
  }))

  await supabase.from('project_boolean_strings').insert(inserts)

  // Log activity
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

  // Return the requesting user's variation
  const myIdx       = targetUserIds.indexOf(user.id)
  const myVariation = inserts[myIdx >= 0 ? myIdx : 0]

  return NextResponse.json({
    variation: {
      linkedin_string: myVariation.linkedin_string,
      indeed_string:   myVariation.indeed_string,
    },
    ...(scope === 'all' ? {
      all: inserts.map(v => ({
        user_id:         v.user_id,
        linkedin_string: v.linkedin_string,
        indeed_string:   v.indeed_string,
      })),
    } : {}),
  })
}
