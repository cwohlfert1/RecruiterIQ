/**
 * Client-side context builder for Cortex AI.
 * Builds page_context string based on current route and injected data.
 */

export interface ProjectContext {
  title: string
  clientName: string
  jdText: string | null
  candidates: Array<{
    name: string
    cqiScore: number | null
    recommendation?: string | null
    flagType?: string | null
  }>
  slideoutCandidate?: {
    name: string
    cqiScore: number | null
    cqiBreakdown?: Record<string, { score: number }> | null
    resumeExcerpt?: string
  } | null
}

let _projectContext: ProjectContext | null = null

/** Call from project page to inject live project data for Cortex */
export function setProjectContext(ctx: ProjectContext | null) {
  _projectContext = ctx
}

export function buildPageContext(pathname: string): string {
  // Project page — use injected context if available
  if (pathname.match(/^\/dashboard\/projects\/[^/]+$/)) {
    if (_projectContext) {
      const ctx = _projectContext
      const top5 = ctx.candidates
        .filter(c => c.cqiScore !== null)
        .sort((a, b) => (b.cqiScore ?? 0) - (a.cqiScore ?? 0))
        .slice(0, 5)

      let context = `Project: "${ctx.title}" for ${ctx.clientName}\n`

      if (ctx.jdText) {
        context += `\nJob Description (excerpt):\n${ctx.jdText.slice(0, 1500)}\n`
      }

      if (top5.length > 0) {
        context += `\nTop ${top5.length} candidates by CQI:\n`
        top5.forEach((c, i) => {
          context += `${i + 1}. ${c.name} — CQI ${c.cqiScore}/100`
          if (c.recommendation) context += ` (${c.recommendation})`
          if (c.flagType) context += ` [FLAGGED: ${c.flagType}]`
          context += '\n'
        })
      }

      if (ctx.slideoutCandidate) {
        const sc = ctx.slideoutCandidate
        context += `\nCurrently viewing candidate: ${sc.name}`
        if (sc.cqiScore) context += ` — CQI ${sc.cqiScore}/100`
        if (sc.cqiBreakdown) {
          const entries = Object.entries(sc.cqiBreakdown)
            .filter(([k]) => k !== 'recommendation')
            .map(([k, v]) => `${k}: ${v.score}/100`)
            .join(', ')
          context += `\nBreakdown: ${entries}`
        }
        if (sc.resumeExcerpt) {
          context += `\nResume excerpt: ${sc.resumeExcerpt.slice(0, 500)}`
        }
      }

      return context
    }
    return 'User is viewing a project page with candidates, JD, and pipeline.'
  }

  if (pathname === '/dashboard/scorer') {
    return 'User is on the Resume Scorer page — they may have just scored a resume.'
  }

  if (pathname === '/dashboard/boolean') {
    return 'User is on the Boolean String Generator — they may need help refining search strings.'
  }

  if (pathname === '/dashboard/summary') {
    return 'User is on the Client Summary Generator — writing candidate briefs.'
  }

  if (pathname === '/dashboard/spread-tracker') {
    return 'User is on the Spread Tracker — managing contractor placements and weekly margin.'
  }

  if (pathname === '/dashboard/ranking') {
    return 'User is on Stack Ranking — comparing multiple candidates for a role.'
  }

  if (pathname === '/dashboard') {
    return 'User is on the main dashboard.'
  }

  return 'General recruiting assistant mode — no specific page context loaded.'
}

export function getContextLabel(pathname: string): string {
  if (_projectContext && pathname.match(/^\/dashboard\/projects\/[^/]+$/)) {
    return `${_projectContext.title} — ${_projectContext.clientName}`
  }
  if (pathname.match(/^\/dashboard\/projects\/[^/]+$/)) return 'Project context'
  if (pathname === '/dashboard/scorer') return 'Resume Scorer'
  if (pathname === '/dashboard/boolean') return 'Boolean Generator'
  if (pathname === '/dashboard/summary') return 'Summary Generator'
  if (pathname === '/dashboard/spread-tracker') return 'Spread Tracker'
  if (pathname === '/dashboard/ranking') return 'Stack Ranking'
  return 'Recruiting Expert'
}
