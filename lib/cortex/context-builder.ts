/**
 * Client-side context builder for Cortex AI.
 * Extracts page context based on current route and available data.
 */

export function buildPageContext(pathname: string): string {
  // Project page
  if (pathname.match(/^\/dashboard\/projects\/[^/]+$/)) {
    return 'User is viewing a project page with candidates, JD, and pipeline.'
  }

  // Resume Scorer
  if (pathname === '/dashboard/scorer') {
    return 'User is on the Resume Scorer page — they may have just scored a resume.'
  }

  // Boolean Generator
  if (pathname === '/dashboard/boolean') {
    return 'User is on the Boolean String Generator — they may need help refining search strings.'
  }

  // Summary Generator
  if (pathname === '/dashboard/summary') {
    return 'User is on the Client Summary Generator — writing candidate briefs.'
  }

  // Spread Tracker
  if (pathname === '/dashboard/spread-tracker') {
    return 'User is on the Spread Tracker — managing contractor placements and weekly margin.'
  }

  // Stack Ranking
  if (pathname === '/dashboard/ranking') {
    return 'User is on Stack Ranking — comparing multiple candidates for a role.'
  }

  // Dashboard home
  if (pathname === '/dashboard') {
    return 'User is on the main dashboard.'
  }

  return 'General recruiting assistant mode — no specific page context loaded.'
}

export function getContextLabel(pathname: string): string {
  if (pathname.match(/^\/dashboard\/projects\/[^/]+$/)) return 'Project context'
  if (pathname === '/dashboard/scorer') return 'Resume Scorer'
  if (pathname === '/dashboard/boolean') return 'Boolean Generator'
  if (pathname === '/dashboard/summary') return 'Summary Generator'
  if (pathname === '/dashboard/spread-tracker') return 'Spread Tracker'
  if (pathname === '/dashboard/ranking') return 'Stack Ranking'
  return 'General assistant'
}
