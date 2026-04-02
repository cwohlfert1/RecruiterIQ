import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/benchmarks/compare
// Body: { resume_text, cqi_score, role_title }
// Returns best matching hire_benchmark for this agency (min 3 keyword overlap)

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { resume_text?: unknown; cqi_score?: unknown; role_title?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ match: null })
  }

  const { cqi_score, role_title } = body

  // Fetch all benchmarks for this agency
  const { data: benchmarks } = await supabase
    .from('hire_benchmarks')
    .select('id, role_keywords, cqi_score, trust_score, skill_score, resume_summary, hired_at, project_id')
    .eq('agency_owner_id', user.id)
    .order('hired_at', { ascending: false })
    .limit(50)

  if (!benchmarks || benchmarks.length === 0) {
    return NextResponse.json({ match: null })
  }

  // Build search terms from role_title
  const titleTerms = typeof role_title === 'string'
    ? role_title.toLowerCase().split(/\W+/).filter(t => t.length > 2)
    : []

  // Score each benchmark by keyword overlap
  let bestMatch: typeof benchmarks[0] | null = null
  let bestScore = 0

  for (const bm of benchmarks) {
    const bmKeywords: string[] = (bm.role_keywords ?? []).map((k: string) => k.toLowerCase())
    let overlap = 0
    for (const term of titleTerms) {
      if (bmKeywords.some(k => k.includes(term) || term.includes(k))) {
        overlap++
      }
    }
    if (overlap >= 3 && overlap > bestScore) {
      bestScore  = overlap
      bestMatch  = bm
    }
  }

  if (!bestMatch) {
    return NextResponse.json({ match: null })
  }

  // Fetch the project title for display
  const { data: project } = await supabase
    .from('projects')
    .select('title, hired_candidate_name')
    .eq('id', bestMatch.project_id)
    .single()

  return NextResponse.json({
    match: {
      cqi_score:      bestMatch.cqi_score,
      trust_score:    bestMatch.trust_score,
      skill_score:    bestMatch.skill_score,
      resume_summary: bestMatch.resume_summary,
      hired_at:       bestMatch.hired_at,
      role_title:     project?.title ?? null,
      hired_name:     project?.hired_candidate_name ?? null,
      this_cqi:       typeof cqi_score === 'number' ? cqi_score : null,
    },
  })
}
