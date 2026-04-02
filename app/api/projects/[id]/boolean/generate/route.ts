import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic, MODEL } from '@/lib/anthropic'
import { incrementAICallCount } from '@/lib/ai-gate'
import type { ProjectActivityType } from '@/types/database'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // Fetch project + members
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title, client_name, jd_text, project_members(id, user_id, role)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find(m => m.user_id === user.id)
  const isOwner      = project.owner_id === user.id
  const callerRole   = callerMember?.role ?? (isOwner ? 'owner' : null)

  if (!callerRole || callerRole === 'viewer') {
    return NextResponse.json({ error: 'Collaborator access required' }, { status: 403 })
  }

  if (!project.jd_text) {
    return NextResponse.json({ error: 'Job description required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const allUserIds = Array.from(new Set([project.owner_id, ...members.map(m => m.user_id)]))
  const n = Math.max(allUserIds.length, 1)

  // Generate N × 2 variations (targeted + broad per recruiter)
  const prompt = `You are a Boolean search string expert for technical recruiting.

Job Title: ${project.title}
Client: ${project.client_name}

Job Description:
${project.jd_text.slice(0, 3000)}

Generate ${n} recruiter variation${n !== 1 ? 's' : ''}, each with TWO Boolean search strings:

VARIANT 1 — TARGETED (strict):
- Use AND logic throughout
- Exact job title matches only
- All required skills ANDed together
- Designed to return 50–200 results on LinkedIn
- variant_type: "targeted"

VARIANT 2 — BROAD (inclusive):
- Use OR groups for title variations and synonyms
- Nice-to-have skills as OR alternatives
- More flexible seniority expressions
- Designed to return 500–2000 results
- variant_type: "broad"

Each recruiter's strings must be genuinely distinct (different title synonyms, skill permutations, seniority expressions) to avoid candidate overlap between team members.

Return ONLY valid JSON array — no explanation, no markdown:
[
  {
    "targeted": {
      "linkedin_string": "...",
      "indeed_string": "..."
    },
    "broad": {
      "linkedin_string": "...",
      "indeed_string": "..."
    }
  }
]

Generate exactly ${n} variation${n !== 1 ? 's' : ''}.
LinkedIn strings: use AND, OR, NOT, parentheses, quoted phrases.
Indeed strings: space-separated terms, minus sign for exclusions.`

  let variations: Array<{
    targeted: { linkedin_string: string; indeed_string: string }
    broad:    { linkedin_string: string; indeed_string: string }
  }> = []

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: Math.max(1200, n * 500),
      messages:   [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in response')

    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid response format')

    variations = parsed.slice(0, n)
    while (variations.length < n) {
      variations.push({ ...variations[variations.length - 1] })
    }
  } catch (err) {
    console.error('Boolean generation error:', err)
    return NextResponse.json({ error: 'Failed to generate variations' }, { status: 500 })
  }

  await incrementAICallCount(user.id)

  // Archive all existing active strings for this project
  await admin
    .from('project_boolean_strings')
    .update({ is_active: false })
    .eq('project_id', params.id)
    .eq('is_active', true)

  // Insert targeted + broad rows per user
  const inserts: Array<Record<string, unknown>> = []
  for (let i = 0; i < allUserIds.length; i++) {
    const uid = allUserIds[i]
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

  const { error: insertError } = await admin
    .from('project_boolean_strings')
    .insert(inserts)

  if (insertError) {
    console.error('[boolean-generate] insert error:', insertError.message)
    return NextResponse.json({ error: 'Failed to save variations' }, { status: 500 })
  }

  await admin.from('project_activity').insert({
    project_id:    params.id,
    user_id:       user.id,
    action_type:   'boolean_generated' satisfies ProjectActivityType,
    metadata_json: { count: n },
  })

  const myIdx      = allUserIds.indexOf(user.id)
  const myV        = variations[myIdx >= 0 ? myIdx : 0]

  return NextResponse.json({
    targeted: { linkedin_string: myV.targeted.linkedin_string, indeed_string: myV.targeted.indeed_string },
    broad:    { linkedin_string: myV.broad.linkedin_string,    indeed_string: myV.broad.indeed_string    },
    count: n,
  })
}
