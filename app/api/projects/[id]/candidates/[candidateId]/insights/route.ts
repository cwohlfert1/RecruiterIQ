import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, MODEL } from '@/lib/anthropic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; candidateId: string } },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Fetch project + candidate
  const [{ data: project }, { data: candidate }] = await Promise.all([
    supabase.from('projects').select('id, owner_id, jd_text').eq('id', params.id).single(),
    supabase.from('project_candidates')
      .select('id, project_id, resume_text, cqi_score, cqi_breakdown_json, insights_json')
      .eq('id', params.candidateId)
      .eq('project_id', params.id)
      .is('deleted_at', null)
      .single(),
  ])

  if (!project || !candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!candidate.cqi_score) return NextResponse.json({ error: 'Candidate not scored' }, { status: 400 })

  // If insights already exist and match current score, return cached
  if (candidate.insights_json && candidate.insights_json._cqi_score === candidate.cqi_score) {
    return NextResponse.json({ insights: candidate.insights_json })
  }

  const breakdownStr = candidate.cqi_breakdown_json
    ? Object.entries(candidate.cqi_breakdown_json)
        .filter(([k]) => k !== 'recommendation')
        .map(([k, v]) => `${k}: ${(v as { score: number }).score}/100`)
        .join(', ')
    : ''

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: 'You are a senior technical recruiter reviewing a candidate for a specific role. Give direct, honest, recruiter-to-recruiter insights. No fluff. Return ONLY valid JSON.',
      messages: [{
        role: 'user',
        content: `Analyze this candidate against the job description and provide insights in the following JSON format exactly:

{
  "overqualified": boolean,
  "overqualified_reason": string or null,
  "submit_if": ["bullet 1", "bullet 2", "bullet 3"],
  "avoid_if": ["bullet 1", "bullet 2", "bullet 3"],
  "key_gaps": ["specific gap 1", "specific gap 2"]
}

Overqualified detection rules:
- Flag as overqualified if candidate has 2x or more years than JD requires AND holds senior titles (Founder, CEO, Director, VP, Principal, Staff) that suggest they are above the role level
- Do NOT flag as overqualified just for having extra years — only flag if title + years combination suggests a level mismatch

Submit if rules:
- 3-5 bullets, each a specific condition where this candidate makes sense to submit
- Reference actual details from the resume and JD — not generic statements

Avoid if rules:
- 3-5 bullets, each a specific condition that would make this candidate a poor fit
- Reference actual details — not generic statements

Key gaps rules:
- Only list tools, certifications, or experience explicitly mentioned in the JD as required or nice-to-have that are clearly absent from the resume
- Be specific: "No MicroStation" not "missing some tools"
- Maximum 5 gaps — only the most important ones
- Empty array if no gaps found

JD:
${project.jd_text?.slice(0, 3000) ?? 'Not provided'}

Resume:
${candidate.resume_text.slice(0, 5000)}

CQI Score: ${candidate.cqi_score}/100
CQI Breakdown: ${breakdownStr}`,
      }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')

    const insights = JSON.parse(match[0])

    // Cache with score reference so we know when to regenerate
    const cached = { ...insights, _cqi_score: candidate.cqi_score }
    await supabase.from('project_candidates')
      .update({ insights_json: cached })
      .eq('id', params.candidateId)

    return NextResponse.json({ insights: cached })
  } catch (err) {
    console.error('[insights] generation error:', err)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
