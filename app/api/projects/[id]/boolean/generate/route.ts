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

  // All user IDs to generate for (owner + all project members)
  const allUserIds = Array.from(new Set([project.owner_id, ...members.map(m => m.user_id)]))
  const n = allUserIds.length

  // Generate N variations via Claude
  const prompt = `You are a Boolean search string expert for technical recruiting.

Job Title: ${project.title}
Client: ${project.client_name}

Job Description:
${project.jd_text.slice(0, 3000)}

Generate ${n} unique Boolean search string variation${n !== 1 ? 's' : ''}.
Each variation must use DIFFERENT combinations of:
- Title synonyms (e.g., "Software Engineer" vs "Developer" vs "Programmer")
- Skill permutations (different aliases and groupings of the same core skills)
- Seniority expressions (e.g., "Senior" vs "5+ years" vs "Lead" vs "Principal")
- Exclusion terms (NOT intern vs NOT junior vs NOT "entry level")

Return ONLY valid JSON array, no explanation, no markdown:
[
  {
    "linkedin_string": "(title OR synonym) AND (skill1 OR skill2) AND (Senior OR \"5+ years\") NOT junior",
    "indeed_string": "title skill1 skill2 -junior -intern"
  }
]

Generate exactly ${n} variation${n !== 1 ? 's' : ''}.
LinkedIn strings: use AND, OR, NOT, parentheses, quoted phrases.
Indeed strings: space-separated terms, minus sign for exclusions (no AND/OR).
Make each variation genuinely distinct so recruiters using different strings find different candidate pools.`

  let variations: Array<{ linkedin_string: string; indeed_string: string }> = []

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: Math.max(800, n * 300),
      messages:   [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in response')

    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid response format')

    variations = parsed.slice(0, n)
    // Pad if Claude returned fewer than expected
    while (variations.length < n) {
      variations.push({ ...variations[variations.length - 1] })
    }
  } catch (err) {
    console.error('Boolean generation error:', err)
    return NextResponse.json({ error: 'Failed to generate variations' }, { status: 500 })
  }

  await incrementAICallCount(user.id)

  // Archive all existing active strings for this project
  await supabase
    .from('project_boolean_strings')
    .update({ is_active: false })
    .eq('project_id', params.id)
    .eq('is_active', true)

  // Insert new active strings
  const inserts = allUserIds.map((uid, i) => ({
    project_id:      params.id,
    user_id:         uid,
    linkedin_string: variations[i].linkedin_string,
    indeed_string:   variations[i].indeed_string,
    is_active:       true,
    created_by:      user.id,
  }))

  const { error: insertError } = await supabase
    .from('project_boolean_strings')
    .insert(inserts)

  if (insertError) {
    console.error('Insert error:', insertError)
    return NextResponse.json({ error: 'Failed to save variations' }, { status: 500 })
  }

  // Log activity
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await admin.from('project_activity').insert({
    project_id:    params.id,
    user_id:       user.id,
    action_type:   'boolean_generated' satisfies ProjectActivityType,
    metadata_json: { count: n },
  })

  // Return the requesting user's variation
  const myIdx      = allUserIds.indexOf(user.id)
  const myVariation = inserts[myIdx >= 0 ? myIdx : 0]

  return NextResponse.json({
    variation: {
      linkedin_string: myVariation.linkedin_string,
      indeed_string:   myVariation.indeed_string,
    },
    count: n,
  })
}
