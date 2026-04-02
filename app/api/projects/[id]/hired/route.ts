import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { anthropic, MODEL } from '@/lib/anthropic'
import type { ProjectActivityType } from '@/types/database'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { candidate_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { candidate_id } = body
  if (typeof candidate_id !== 'string' || !candidate_id) {
    return NextResponse.json({ error: 'candidate_id required' }, { status: 400 })
  }

  // Verify project access
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title, client_name, jd_text, project_members(user_id, role)')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members: Array<{ user_id: string; role: string }> = project.project_members ?? []
  const callerMember = members.find((m: { user_id: string }) => m.user_id === user.id)
  const isOwner      = project.owner_id === user.id
  const callerRole   = callerMember?.role ?? (isOwner ? 'owner' : null)
  if (!callerRole || callerRole === 'viewer') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Fetch the hired candidate
  const { data: candidate } = await supabase
    .from('project_candidates')
    .select('id, candidate_name, candidate_email, resume_text, cqi_score')
    .eq('id', candidate_id)
    .eq('project_id', params.id)
    .single()

  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch trust/skill scores if available (via assessment_sessions)
  const { data: assessSession } = await supabase
    .from('assessment_sessions')
    .select('trust_score, skill_score')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const trustScore = assessSession?.trust_score ?? null
  const skillScore = assessSession?.skill_score ?? null

  // Extract role keywords + generate resume summary via Cortex
  let roleKeywords: string[] = []
  let resumeSummary          = ''

  const combinedContext = `Job Title: ${project.title}\nJob Description: ${(project.jd_text ?? '').slice(0, 1500)}\nResume: ${(candidate.resume_text ?? '').slice(0, 1500)}`

  try {
    const aiRes = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 400,
      messages:   [{
        role:    'user',
        content: `${combinedContext}

Extract 5-8 role keywords (skills, level, industry) AND write a 2-sentence summary of why this candidate was a great hire.

Return ONLY valid JSON:
{
  "keywords": ["React", "TypeScript", "Senior", "Frontend", "SaaS"],
  "summary": "Two sentences about why they were hired."
}`,
      }],
    })

    const raw     = aiRes.content[0].type === 'text' ? aiRes.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed  = JSON.parse(cleaned) as { keywords?: string[]; summary?: string }
    roleKeywords  = Array.isArray(parsed.keywords) ? parsed.keywords : []
    resumeSummary = typeof parsed.summary === 'string' ? parsed.summary : ''
  } catch {
    // Non-fatal — still mark hired without benchmark keywords
    roleKeywords  = [project.title]
    resumeSummary = `${candidate.candidate_name} was selected for the ${project.title} role.`
  }

  // 1. Mark candidate as hired + set pipeline_stage to placed
  await supabase
    .from('project_candidates')
    .update({ hired: true, pipeline_stage: 'placed' })
    .eq('id', candidate_id)

  // 2. Update project: hired_candidate_id, hired_candidate_name, status = filled
  await supabase
    .from('projects')
    .update({
      status:               'filled',
      hired_candidate_id:   candidate_id,
      hired_candidate_name: candidate.candidate_name,
    })
    .eq('id', params.id)

  // 3. Insert hire_benchmark
  await admin.from('hire_benchmarks').insert({
    agency_owner_id: user.id,
    role_keywords:   roleKeywords,
    template_type:   null,
    cqi_score:       candidate.cqi_score ?? null,
    trust_score:     trustScore,
    skill_score:     skillScore,
    resume_summary:  resumeSummary,
    project_id:      params.id,
  })

  // 4. Log activity
  await admin.from('project_activity').insert({
    project_id:    params.id,
    user_id:       user.id,
    action_type:   'candidate_hired' satisfies ProjectActivityType,
    metadata_json: {
      candidate_name: candidate.candidate_name,
      candidate_id,
    },
  })

  // 5. Post Teams webhook if enabled
  const { data: proj } = await supabase
    .from('projects')
    .select('teams_webhook_url')
    .eq('id', params.id)
    .single()

  if (proj?.teams_webhook_url) {
    fetch(proj.teams_webhook_url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        '@type':    'MessageCard',
        themeColor: 'f59e0b',
        summary:    'Candidate hired',
        sections:   [{
          activityTitle:    `🎉 Placement! — ${project.title}`,
          activitySubtitle: `${candidate.candidate_name} has been marked as hired`,
          facts: [
            { name: 'Role',      value: project.title      },
            { name: 'Client',    value: project.client_name },
            { name: 'CQI Score', value: `${candidate.cqi_score ?? '—'}/100` },
          ],
        }],
      }),
    }).catch(() => {/* silent */})
  }

  return NextResponse.json({
    success:  true,
    keywords: roleKeywords,
    summary:  resumeSummary,
  })
}
