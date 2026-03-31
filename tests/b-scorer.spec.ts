/**
 * PART B — Resume Scorer
 * All tests require authentication (uses stored auth state).
 * AI API calls are mocked with page.route() to avoid real Claude usage.
 */
import { test, expect } from '@playwright/test'

const MOCK_SCORE_RESULT = {
  score:     85,
  job_title: 'Software Engineer',
  record_id: 'test-record-001',
  breakdown: {
    must_have_skills:  { score: 90, weight: 0.40, weighted: 36.0,  explanation: 'Strong alignment with required skills.' },
    domain_experience: { score: 80, weight: 0.20, weighted: 16.0,  explanation: 'Relevant industry background present.' },
    communication:     { score: 85, weight: 0.15, weighted: 12.75, explanation: 'Resume is clear and well-structured.' },
    tenure_stability:  { score: 75, weight: 0.10, weighted: 7.50,  explanation: 'Average tenure ~2 years per role.' },
    tool_depth:        { score: 88, weight: 0.15, weighted: 13.20, explanation: 'Proficient in relevant tools.' },
  },
}

const SHORT_JD     = 'We need a senior software engineer with React and TypeScript skills.'
const SHORT_RESUME = 'John Smith. Senior Software Engineer. 5 years at Acme Corp. Skills: React, TypeScript, Node.js.'

test.describe('B — Resume Scorer', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/scorer')
    await expect(page.locator('main h1')).toContainText('Resume Scorer')
  })

  // ── B1: Both fields required ────────────────────────────────────────────────
  test('B1: empty submit shows both field errors', async ({ page }) => {
    await page.click('button:has-text("Score Resume")')
    await expect(page.locator('text=Job description is required')).toBeVisible()
    await expect(page.locator('text=Resume text is required')).toBeVisible()
  })

  test('B2: only JD filled shows resume error only', async ({ page }) => {
    await page.fill('#jd-input', SHORT_JD)
    await page.click('button:has-text("Score Resume")')
    await expect(page.locator('text=Job description is required')).not.toBeVisible()
    await expect(page.locator('text=Resume text is required')).toBeVisible()
  })

  test('B3: only resume filled shows JD error only', async ({ page }) => {
    await page.fill('#resume-input', SHORT_RESUME)
    await page.click('button:has-text("Score Resume")')
    await expect(page.locator('text=Job description is required')).toBeVisible()
    await expect(page.locator('text=Resume text is required')).not.toBeVisible()
  })

  // ── B4: Word counter ────────────────────────────────────────────────────────
  test('B4: word counter shows 0/2000 on load for JD', async ({ page }) => {
    await expect(page.locator('text=0 / 2,000 words').first()).toBeVisible()
  })

  test('B5: word counter updates as user types', async ({ page }) => {
    await page.fill('#jd-input', 'one two three four five')
    await expect(page.locator('text=5 / 2,000 words')).toBeVisible()
  })

  // ── B6: Warning state at 80% ────────────────────────────────────────────────
  test('B6: JD counter turns yellow at 80% (1600 words)', async ({ page }) => {
    // Generate exactly 1600 words
    const text = Array.from({ length: 1600 }, (_, i) => `word${i}`).join(' ')
    await page.fill('#jd-input', text)
    // WordCounter component adds text-yellow-400 at pct >= 0.8
    const counter = page.locator('span.text-yellow-400').first()
    await expect(counter).toBeVisible()
  })

  // ── B7: Red state at/over limit ─────────────────────────────────────────────
  test('B7: JD counter turns red at 2000+ words', async ({ page }) => {
    const text = Array.from({ length: 2001 }, (_, i) => `word${i}`).join(' ')
    await page.fill('#jd-input', text)
    const counter = page.locator('span.text-red-400').first()
    await expect(counter).toBeVisible()
  })

  // ── B8: Score ring renders with correct color (mock API) ───────────────────
  test('B8: score ring renders after successful submission', async ({ page }) => {
    await page.route('/api/score-resume', async (route) => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify(MOCK_SCORE_RESULT),
      })
    })

    await page.fill('#jd-input', SHORT_JD)
    await page.fill('#resume-input', SHORT_RESUME)
    await page.click('button:has-text("Score Resume")')

    // Score ring SVG should render
    await expect(page.locator('svg').filter({ has: page.locator('circle') }).first()).toBeVisible({ timeout: 15_000 })

    // Score number should animate to 85
    await expect(page.locator('text=85')).toBeVisible({ timeout: 10_000 })
  })

  // ── B9: Score ring color correct (green for 80+) ────────────────────────────
  test('B9: score label shows STRONG MATCH for score >= 80', async ({ page }) => {
    await page.route('/api/score-resume', async (route) => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify(MOCK_SCORE_RESULT), // score 85
      })
    })

    await page.fill('#jd-input', SHORT_JD)
    await page.fill('#resume-input', SHORT_RESUME)
    await page.click('button:has-text("Score Resume")')
    await expect(page.locator('text=STRONG MATCH')).toBeVisible({ timeout: 10_000 })
  })

  test('B10: score label shows PARTIAL MATCH for score 60-79', async ({ page }) => {
    const yellow = { ...MOCK_SCORE_RESULT, score: 70 }
    await page.route('/api/score-resume', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(yellow) })
    })
    await page.fill('#jd-input', SHORT_JD)
    await page.fill('#resume-input', SHORT_RESUME)
    await page.click('button:has-text("Score Resume")')
    await expect(page.locator('text=PARTIAL MATCH')).toBeVisible({ timeout: 10_000 })
  })

  test('B11: score label shows WEAK MATCH for score < 60', async ({ page }) => {
    const red = { ...MOCK_SCORE_RESULT, score: 40 }
    await page.route('/api/score-resume', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(red) })
    })
    await page.fill('#jd-input', SHORT_JD)
    await page.fill('#resume-input', SHORT_RESUME)
    await page.click('button:has-text("Score Resume")')
    await expect(page.locator('text=WEAK MATCH')).toBeVisible({ timeout: 10_000 })
  })

  // ── B12: 5 category breakdown bars render ───────────────────────────────────
  test('B12: all 5 category breakdown rows render', async ({ page }) => {
    await page.route('/api/score-resume', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SCORE_RESULT) })
    })
    await page.fill('#jd-input', SHORT_JD)
    await page.fill('#resume-input', SHORT_RESUME)
    await page.click('button:has-text("Score Resume")')

    await expect(page.locator('text=Must-Have Skills')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Domain Experience')).toBeVisible()
    await expect(page.locator('text=Communication')).toBeVisible()
    await expect(page.locator('text=Tenure Stability')).toBeVisible()
    await expect(page.locator('text=Tool Depth')).toBeVisible()
  })

  // ── B13: "Score Another Resume" clears results ──────────────────────────────
  test('B13: Score Another Resume resets the form', async ({ page }) => {
    await page.route('/api/score-resume', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SCORE_RESULT) })
    })
    await page.fill('#jd-input', SHORT_JD)
    await page.fill('#resume-input', SHORT_RESUME)
    await page.click('button:has-text("Score Resume")')
    await expect(page.locator('text=STRONG MATCH')).toBeVisible({ timeout: 10_000 })

    await page.click('button:has-text("Score Another Resume")')
    await expect(page.locator('text=STRONG MATCH')).not.toBeVisible()
    await expect(page.locator('#jd-input')).toHaveValue('')
    await expect(page.locator('#resume-input')).toHaveValue('')
  })

  // ── B14: Free tier limit → upgrade modal ────────────────────────────────────
  test('B14: 403 limit_reached response opens upgrade modal', async ({ page }) => {
    await page.route('/api/score-resume', async (route) => {
      await route.fulfill({
        status:      403,
        contentType: 'application/json',
        body:        JSON.stringify({ error: 'limit_reached' }),
      })
    })
    await page.fill('#jd-input', SHORT_JD)
    await page.fill('#resume-input', SHORT_RESUME)
    await page.click('button:has-text("Score Resume")')

    // UpgradeModal should open
    await expect(page.locator('text=Upgrade').first()).toBeVisible({ timeout: 10_000 })
  })
})
