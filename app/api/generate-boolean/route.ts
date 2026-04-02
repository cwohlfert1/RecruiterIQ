import { NextRequest } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { checkAIGate, incrementAICallCount } from '@/lib/ai-gate'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // 1. Auth + plan gate — available to all plans
  const gate = await checkAIGate()
  if (!gate.allowed) {
    const status = gate.reason === 'unauthenticated' ? 401 : 403
    return Response.json(
      { error: 'Access denied', reason: gate.reason, planTier: gate.planTier },
      { status },
    )
  }

  // 2. Parse body
  let body: {
    jd_text?: unknown
    jobTitle?: unknown
    requiredSkills?: unknown
    optionalSkills?: unknown
    exclusions?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const gateAllowed = gate as { userId: string }

  if (body.jd_text !== undefined) {
    return handleJdMode(body.jd_text, gateAllowed)
  }
  return handleManualMode(body, gateAllowed)
}

// ─── Option A: JD paste → targeted + broad variants ──────────────────────────

async function handleJdMode(
  jdTextRaw: unknown,
  gate: { userId: string },
) {
  if (typeof jdTextRaw !== 'string' || !jdTextRaw.trim()) {
    return Response.json({ error: 'Job description is required' }, { status: 400 })
  }

  const jdText = jdTextRaw.trim().slice(0, 8000)

  const prompt = `You are a Boolean search string expert for technical recruiting.

Job Description:
${jdText}

From this job description:
1. Extract the job title and top 5-8 required skills
2. Generate TWO Boolean search string variants:

VARIANT 1 — TARGETED (strict):
- Use AND logic throughout; exact title matches; all required skills ANDed
- Designed to return 50–200 results on LinkedIn

VARIANT 2 — BROAD (inclusive):
- Use OR groups for title variations and synonyms; nice-to-have skills as OR alternatives
- Designed to return 500–2000 results

Return ONLY valid JSON (no markdown, no explanation):
{
  "extracted_title": "job title here",
  "extracted_skills": ["skill1", "skill2", "skill3"],
  "targeted": {
    "linkedin_string": "...",
    "indeed_string": "..."
  },
  "broad": {
    "linkedin_string": "...",
    "indeed_string": "..."
  }
}`

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 900,
      messages:   [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object in response')

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.targeted?.linkedin_string || !parsed.broad?.linkedin_string) throw new Error('Invalid response format')

    // Persist (log targeted string for history)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    await db.from('boolean_searches').insert({
      user_id:         gate.userId,
      job_title:       parsed.extracted_title ?? 'JD-based search',
      required_skills: Array.isArray(parsed.extracted_skills) ? parsed.extracted_skills : [],
      optional_skills: [],
      exclusions:      [],
      boolean_output:  parsed.targeted.linkedin_string,
    })
    await db.from('activity_log').insert({
      user_id:     gate.userId,
      feature:     'boolean',
      description: `Generated Boolean strings from job description`,
    })
    await incrementAICallCount(gate.userId)

    return Response.json({
      extracted_title:  parsed.extracted_title  ?? '',
      extracted_skills: Array.isArray(parsed.extracted_skills) ? parsed.extracted_skills : [],
      targeted: {
        linkedin_string: parsed.targeted.linkedin_string,
        indeed_string:   parsed.targeted.indeed_string ?? '',
      },
      broad: {
        linkedin_string: parsed.broad.linkedin_string,
        indeed_string:   parsed.broad.indeed_string ?? '',
      },
    })
  } catch (err) {
    console.error('[generate-boolean jd-mode]', err)
    return Response.json({ error: 'Failed to generate from job description' }, { status: 500 })
  }
}

// ─── Option B: Manual fields → targeted + broad variants ─────────────────────

async function handleManualMode(
  body: {
    jobTitle?: unknown
    requiredSkills?: unknown
    optionalSkills?: unknown
    exclusions?: unknown
  },
  gate: { userId: string },
) {
  const { jobTitle, requiredSkills, optionalSkills, exclusions } = body

  if (typeof jobTitle !== 'string' || !jobTitle.trim()) {
    return Response.json({ error: 'Job title is required' }, { status: 400 })
  }
  if (jobTitle.trim().length > 100) {
    return Response.json({ error: 'Job title must be 100 characters or fewer' }, { status: 400 })
  }
  if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
    return Response.json({ error: 'At least one required skill is needed' }, { status: 400 })
  }
  if (requiredSkills.length > 10) {
    return Response.json({ error: 'Maximum 10 required skills allowed' }, { status: 400 })
  }
  for (const skill of requiredSkills) {
    if (typeof skill !== 'string' || skill.trim().length === 0) {
      return Response.json({ error: 'Required skills must be non-empty strings' }, { status: 400 })
    }
  }

  const safeRequired   = (requiredSkills as string[]).map(s => s.trim())
  const safeOptional   = Array.isArray(optionalSkills)
    ? (optionalSkills as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
    : []
  const safeExclusions = Array.isArray(exclusions)
    ? (exclusions as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map(s => s.trim())
    : []
  const safeJobTitle = jobTitle.trim()

  const prompt = `You are a Boolean search string expert for technical recruiting.

Job Title: ${safeJobTitle}
Required Skills: ${safeRequired.join(', ')}
Optional Skills: ${safeOptional.length > 0 ? safeOptional.join(', ') : 'None'}
Exclusions: ${safeExclusions.length > 0 ? safeExclusions.join(', ') : 'None'}

Generate TWO Boolean search string variants:

VARIANT 1 — TARGETED (strict):
- Use AND logic for required skills; exact job title; include all required skills as ANDed
- Designed to return 50–200 results on LinkedIn

VARIANT 2 — BROAD (inclusive):
- Use OR groups for title variations and synonyms; optional skills as OR alternatives
- Designed to return 500–2000 results

LinkedIn strings: use AND, OR, NOT, parentheses, quoted phrases.
Indeed strings: space-separated terms, minus sign for exclusions.

Return ONLY valid JSON (no markdown, no explanation):
{
  "targeted": {
    "linkedin_string": "...",
    "indeed_string": "..."
  },
  "broad": {
    "linkedin_string": "...",
    "indeed_string": "..."
  }
}`

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object in response')

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.targeted?.linkedin_string || !parsed.broad?.linkedin_string) throw new Error('Invalid response format')

    // Persist
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    await db.from('boolean_searches').insert({
      user_id:         gate.userId,
      job_title:       safeJobTitle,
      required_skills: safeRequired,
      optional_skills: safeOptional,
      exclusions:      safeExclusions,
      boolean_output:  parsed.targeted.linkedin_string,
    })
    await db.from('activity_log').insert({
      user_id:     gate.userId,
      feature:     'boolean',
      description: `Generated Boolean strings for ${safeJobTitle}`,
    })
    await incrementAICallCount(gate.userId)

    return Response.json({
      targeted: {
        linkedin_string: parsed.targeted.linkedin_string,
        indeed_string:   parsed.targeted.indeed_string ?? '',
      },
      broad: {
        linkedin_string: parsed.broad.linkedin_string,
        indeed_string:   parsed.broad.indeed_string ?? '',
      },
    })
  } catch (err) {
    console.error('[generate-boolean manual-mode]', err)
    return Response.json({ error: 'Failed to generate Boolean strings' }, { status: 500 })
  }
}
