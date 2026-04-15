/**
 * Client Intel — job title tokenizer + intel refresh after outcomes.
 */

const STOP_WORDS = new Set([
  'senior', 'junior', 'lead', 'staff', 'principal', 'associate',
  'i', 'ii', 'iii', 'iv', 'v', 'the', 'a', 'an', 'of', 'and', 'or',
  'sr', 'jr', 'mgr', 'dir',
])

/** Extract meaningful tokens from a job title */
export function tokenizeJobTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t))
}

/** Check if two job titles are similar (2+ shared tokens) */
export function isSimilarTitle(a: string, b: string): boolean {
  const tokensA = tokenizeJobTitle(a)
  const tokensB = new Set(tokenizeJobTitle(b))
  const overlap = tokensA.filter(t => tokensB.has(t)).length
  return overlap >= 2
}

/**
 * Refresh client_intel for a given user + client after an outcome is saved.
 * Call from the stage change API route.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function refreshClientIntel(db: any, userId: string, clientCompany: string, jobTitle: string) {
  const tokens = tokenizeJobTitle(jobTitle)

  // Fetch all outcomes for this user + client
  const { data: outcomes } = await db
    .from('placement_outcomes')
    .select('cqi_score, outcome, is_catfish, catfish_notes')
    .eq('user_id', userId)
    .eq('client_company', clientCompany)

  if (!outcomes || outcomes.length === 0) return

  const placed = outcomes.filter((o: { outcome: string; cqi_score: number | null }) => o.outcome === 'placed' && o.cqi_score != null)
  const rejected = outcomes.filter((o: { outcome: string; cqi_score: number | null }) => o.outcome === 'rejected' && o.cqi_score != null)
  const catfish = outcomes.filter((o: { is_catfish: boolean; catfish_notes: string | null }) => o.is_catfish && o.catfish_notes)

  const avgPlaced = placed.length > 0
    ? placed.reduce((s: number, o: { cqi_score: number }) => s + Number(o.cqi_score), 0) / placed.length
    : null

  const avgRejected = rejected.length > 0
    ? rejected.reduce((s: number, o: { cqi_score: number }) => s + Number(o.cqi_score), 0) / rejected.length
    : null

  // Success threshold: avg CQI of rejected candidates (below this = risky)
  const threshold = avgRejected != null && avgPlaced != null
    ? Math.round((avgRejected + avgPlaced) / 2)
    : avgRejected

  const catfishPatterns = catfish.length > 0
    ? catfish.map((o: { catfish_notes: string }) => o.catfish_notes).slice(0, 10)
    : null

  await db.from('client_intel').upsert(
    {
      user_id: userId,
      client_company: clientCompany,
      job_title_tokens: tokens,
      outcome_count: outcomes.length,
      avg_cqi_placed: avgPlaced ? Math.round(avgPlaced * 100) / 100 : null,
      avg_cqi_rejected: avgRejected ? Math.round(avgRejected * 100) / 100 : null,
      success_threshold: threshold ? Math.round(threshold * 100) / 100 : null,
      catfish_patterns: catfishPatterns ? { notes: catfishPatterns } : null,
      last_updated: new Date().toISOString(),
    },
    { onConflict: 'user_id,client_company' },
  )
}
