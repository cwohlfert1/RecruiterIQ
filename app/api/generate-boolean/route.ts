import { NextRequest } from 'next/server'
import { anthropic, MODEL } from '@/lib/anthropic'
import { checkAIGate, incrementAICallCount } from '@/lib/ai-gate'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getRateLimitKey, rateLimitResponse, RATE_AI } from '@/lib/security/rate-limit'

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

  // Rate limit: 20 AI calls/min per user
  const rl = checkRateLimit(getRateLimitKey(req, 'gen-boolean', gate.userId), RATE_AI)
  if (!rl.allowed) return rateLimitResponse(rl)

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

  const systemPrompt = `You are an expert technical recruiter and Boolean search specialist. You build precise, high-performance Boolean strings for LinkedIn Recruiter and Indeed. You understand the difference between candidates who have hands-on experience and those who managed or observed it — and you optimize every string to surface the former.`

  const userPrompt = `Create THREE Boolean search strings for sourcing candidates based on the job description below.

Requirements:
- Generate THREE versions:
  1. Strict (highest precision, fewest results)
  2. Balanced (moderate precision, good volume — RECOMMENDED for most searches)
  3. Broad (widest net, maximum volume)

IMPORTANT CALIBRATION RULES:
- The Strict string MUST be calibrated to return 50-200 results on LinkedIn Recruiter, NOT zero.
- If you have more than 4 AND operators, the string is too restrictive — loosen it.
- Maximum 3 NOT filters on Strict. Broad should have 0-1 NOT filters.
- Use OR groups LIBERALLY within each concept to catch title/tool variations.

Guidelines for all versions:
- Identify core must-have technologies and use AND logic
- Include synonyms and variations using OR logic
- Use parentheses correctly for grouping
- Include common alternate titles for the role

Strict Version (Expected: 50-200 results):
- 3-4 core AND terms maximum
- Each AND term should use OR groups for variations
- Maximum 3 NOT filters (only the most disqualifying: intern, student, professor)
- Prioritize exact tech stack match

Balanced Version (Expected: 200-500 results — RECOMMENDED):
- 2-3 core AND terms
- Generous OR groups for title and tool variations
- 1-2 NOT filters at most
- Good balance of precision and volume

Broad Version (Expected: 500-2000+ results):
- 1-2 core AND terms only
- Expansive OR groups
- No NOT filters unless critical
- Allow adjacent or transferable experience

Secret sauce — apply to ALL versions:
- Prioritize candidates with demonstrated hands-on experience
- If the JD signals an IC role, include NOT filters for Director, VP (counts toward the NOT limit)
- If the JD signals a senior/lead role, filter out intern, junior in Strict only

For each string, estimate the expected LinkedIn result volume as one of: "Low (0-50)", "Medium (50-500)", "High (500+)"

From the job description, also extract the job title and top 5-8 required skills.

Job Description:
${jdText}

Return ONLY valid JSON (no markdown, no explanation):
{
  "extracted_title": "job title here",
  "extracted_skills": ["skill1", "skill2", "skill3"],
  "targeted": {
    "linkedin_string": "...",
    "indeed_string": "...",
    "volume_estimate": "Medium (50-500)"
  },
  "balanced": {
    "linkedin_string": "...",
    "indeed_string": "...",
    "volume_estimate": "Medium (50-500)"
  },
  "broad": {
    "linkedin_string": "...",
    "indeed_string": "...",
    "volume_estimate": "High (500+)"
  }
}`

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1200,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
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
      boolean_output:  parsed.balanced?.linkedin_string ?? parsed.targeted.linkedin_string,
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
        volume_estimate: parsed.targeted.volume_estimate ?? '',
      },
      balanced: {
        linkedin_string: parsed.balanced?.linkedin_string ?? parsed.targeted.linkedin_string,
        indeed_string:   parsed.balanced?.indeed_string ?? parsed.targeted.indeed_string ?? '',
        volume_estimate: parsed.balanced?.volume_estimate ?? '',
      },
      broad: {
        linkedin_string: parsed.broad.linkedin_string,
        indeed_string:   parsed.broad.indeed_string ?? '',
        volume_estimate: parsed.broad.volume_estimate ?? '',
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

  const systemPrompt = `You are an expert technical recruiter and Boolean search specialist. You build precise, high-performance Boolean strings for LinkedIn Recruiter and Indeed. You understand the difference between candidates who have hands-on experience and those who managed or observed it — and you optimize every string to surface the former.`

  const userPrompt = `Create THREE Boolean search strings for sourcing candidates based on the inputs below.

Requirements:
- Generate THREE versions:
  1. Strict (highest precision, fewest results)
  2. Balanced (moderate precision, good volume — RECOMMENDED)
  3. Broad (widest net, maximum volume)

IMPORTANT CALIBRATION RULES:
- The Strict string MUST return 50-200 results, NOT zero.
- Maximum 4 AND operators on Strict. Maximum 3 NOT filters.
- Use OR groups LIBERALLY within each concept.

Strict Version (Expected: 50-200 results):
- 3-4 core AND terms maximum, each with OR groups for variations
- Maximum 3 NOT filters

Balanced Version (Expected: 200-500 results — RECOMMENDED):
- 2-3 core AND terms with generous OR groups
- 1-2 NOT filters at most

Broad Version (Expected: 500-2000+ results):
- 1-2 core AND terms, expansive OR groups, no NOT filters unless critical

For each string, estimate volume: "Low (0-50)", "Medium (50-500)", "High (500+)"

Job Title: ${safeJobTitle}
Must-Have Skills: ${safeRequired.join(', ')}
Nice-to-Have Skills: ${safeOptional.length > 0 ? safeOptional.join(', ') : 'none provided'}
Exclude Terms: ${safeExclusions.length > 0 ? safeExclusions.join(', ') : 'none provided'}

Return ONLY valid JSON (no markdown, no explanation):
{
  "targeted": {
    "linkedin_string": "...",
    "indeed_string": "...",
    "volume_estimate": "Medium (50-500)"
  },
  "balanced": {
    "linkedin_string": "...",
    "indeed_string": "...",
    "volume_estimate": "Medium (50-500)"
  },
  "broad": {
    "linkedin_string": "...",
    "indeed_string": "...",
    "volume_estimate": "High (500+)"
  }
}`

  try {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1200,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
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
      boolean_output:  parsed.balanced?.linkedin_string ?? parsed.targeted.linkedin_string,
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
        volume_estimate: parsed.targeted.volume_estimate ?? '',
      },
      balanced: {
        linkedin_string: parsed.balanced?.linkedin_string ?? parsed.targeted.linkedin_string,
        indeed_string:   parsed.balanced?.indeed_string ?? parsed.targeted.indeed_string ?? '',
        volume_estimate: parsed.balanced?.volume_estimate ?? '',
      },
      broad: {
        linkedin_string: parsed.broad.linkedin_string,
        indeed_string:   parsed.broad.indeed_string ?? '',
        volume_estimate: parsed.broad.volume_estimate ?? '',
      },
    })
  } catch (err) {
    console.error('[generate-boolean manual-mode]', err)
    return Response.json({ error: 'Failed to generate Boolean strings' }, { status: 500 })
  }
}
