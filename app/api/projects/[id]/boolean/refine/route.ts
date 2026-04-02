import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'

type FeedbackBucket = '< 100' | '100-500' | '500-2000' | '2000+'

function getRefinementInstruction(feedback: FeedbackBucket, variantType: string): string {
  const isTargeted = variantType === 'targeted'

  if (feedback === '< 100') {
    return `The current search returned too few results (< 100). LOOSEN it:
- Add 2–3 OR title synonyms / alternative job titles
- Make 1–2 required skills optional (move from AND to OR group)
- Broaden seniority expressions (e.g., add "mid-level" OR "senior" OR "lead")
- Remove overly specific exclusions`
  }

  if (feedback === '100-500') {
    if (isTargeted) {
      return `The search returned 100–500 results. This is PERFECT for a targeted search. No changes needed — confirm as optimal.`
    }
    return `The search returned 100–500 results. This is a bit narrow for a broad search. LOOSEN slightly:
- Add more title OR synonyms
- Make 1 required skill optional`
  }

  if (feedback === '500-2000') {
    if (!isTargeted) {
      return `The search returned 500–2000 results. This is PERFECT for a broad search. No changes needed — confirm as optimal.`
    }
    return `The search returned 500–2000 results. This is too broad for a targeted search. TIGHTEN:
- Add NOT exclusions (junior, intern, entry-level)
- Remove OR groups, use AND for more skills
- Specify seniority more precisely (e.g., "Senior" AND "5+ years")`
  }

  // 2000+
  return `The search returned 2000+ results — too broad. SIGNIFICANTLY TIGHTEN:
- Add specific location constraint
- Add more AND requirements
- Add NOT exclusions (junior, intern, contractor, freelance)
- Specify exact seniority and years of experience
- Remove broad OR groups`
}

function isGoodFeedback(feedback: FeedbackBucket, variantType: string): boolean {
  if (variantType === 'targeted' && feedback === '100-500') return true
  if (variantType === 'broad'    && feedback === '500-2000') return true
  return false
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify project access
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title, project_members(user_id, role)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find(m => m.user_id === user.id)
  const isOwner      = project.owner_id === user.id
  const callerRole   = callerMember?.role ?? (isOwner ? 'owner' : null)
  if (!callerRole || callerRole === 'viewer') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const body = await req.json() as {
    string_id:        string
    variant_type:     string
    feedback:         FeedbackBucket
    current_linkedin: string
    current_indeed:   string
    job_title:        string
    jd_text:          string
  }

  const { string_id, variant_type, feedback, current_linkedin, current_indeed, job_title, jd_text } = body

  // Fetch the string to verify ownership + check refinement count
  const { data: stringRow } = await supabase
    .from('project_boolean_strings')
    .select('id, user_id, refinement_count')
    .eq('id', string_id)
    .eq('project_id', params.id)
    .single()

  if (!stringRow) return NextResponse.json({ error: 'String not found' }, { status: 404 })
  if (stringRow.user_id !== user.id) return NextResponse.json({ error: 'Not your string' }, { status: 403 })

  const currentCount: number = stringRow.refinement_count ?? 0
  if (currentCount >= 3) {
    return NextResponse.json({
      limited: true,
      message: 'Maximum refinements reached. Create a new search to start fresh.',
    })
  }

  // If feedback is perfect — just mark as confirmed, no refinement needed
  if (isGoodFeedback(feedback, variant_type)) {
    await supabase
      .from('project_boolean_strings')
      .update({ feedback })
      .eq('id', string_id)

    return NextResponse.json({
      confirmed: true,
      explanation: variant_type === 'targeted'
        ? 'Your targeted search is performing well — 100–500 results is the sweet spot.'
        : 'Your broad search is performing well — 500–2000 results is the sweet spot.',
      linkedin_string: current_linkedin,
      indeed_string:   current_indeed,
    })
  }

  const refinementInstruction = getRefinementInstruction(feedback, variant_type)

  const prompt = `You are a Boolean search string expert. Refine this search string based on performance feedback.

Job Title: ${job_title}
Job Description excerpt:
${jd_text.slice(0, 2000)}

Current LinkedIn string:
${current_linkedin}

Current Indeed string:
${current_indeed}

Performance feedback: ${feedback} results
Variant type: ${variant_type}

Refinement instruction:
${refinementInstruction}

Return ONLY valid JSON — no explanation, no markdown:
{
  "linkedin_string": "...",
  "indeed_string": "...",
  "explanation": "One sentence explaining what was changed and why"
}`

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 600,
      messages:   [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    // Save refined string + feedback
    await supabase
      .from('project_boolean_strings')
      .update({
        linkedin_string:  parsed.linkedin_string,
        indeed_string:    parsed.indeed_string,
        feedback,
        refinement_count: currentCount + 1,
      })
      .eq('id', string_id)

    return NextResponse.json({
      linkedin_string: parsed.linkedin_string,
      indeed_string:   parsed.indeed_string,
      explanation:     parsed.explanation,
      refinement_count: currentCount + 1,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to refine string' }, { status: 500 })
  }
}
