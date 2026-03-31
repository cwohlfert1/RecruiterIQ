/**
 * PART E — Stack Ranking / CQI Dashboard
 * Agency-only feature. Tests mock the Supabase profile response for plan checks.
 */
import { test, expect, Page } from '@playwright/test'

// Mock ranked results
const MOCK_RANKING = {
  rankingId: 'rank-test-001',
  jobTitle:  'Senior Software Engineer',
  candidates: [
    {
      id:        'c1',
      name:      'Alice Smith',
      cqi_score: 88,
      rank:      1,
      strengths: ['Strong React expertise', 'Excellent CS fundamentals'],
      gaps:      ['Limited mobile experience'],
      notes:     null,
    },
    {
      id:        'c2',
      name:      'Bob Jones',
      cqi_score: 72,
      rank:      2,
      strengths: ['Python proficiency', 'Agile experience'],
      gaps:      ['Junior level overall', 'Limited frontend work'],
      notes:     null,
    },
  ],
}

/**
 * Mock the Supabase REST call for user_profiles (plan check).
 * The ranking page does a client-side Supabase query to check plan_tier.
 */
async function mockAgencyPlan(page: Page) {
  await page.route(/rest\/v1\/user_profiles/, async (route) => {
    // Supabase .single() uses Accept: application/vnd.pgrst.object+json — return object not array
    await route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ plan_tier: 'agency' }),
    })
  })
}

async function mockFreePlan(page: Page) {
  await page.route(/rest\/v1\/user_profiles/, async (route) => {
    await route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify([{ plan_tier: 'free' }]),
    })
  })
}

test.describe('E — Stack Ranking', () => {

  // ── E1: Non-agency user sees upgrade modal ──────────────────────────────────
  test('E1: non-agency user sees upgrade modal on page load', async ({ page }) => {
    await mockFreePlan(page)
    await page.goto('/dashboard/ranking')

    // UpgradeModal should open showing "agency" plan requirement
    await expect(page.locator('[role="dialog"], div').filter({ hasText: /agency/i }).first())
      .toBeVisible({ timeout: 10_000 })
  })

  // ── E2: Non-agency user sees blur overlay ──────────────────────────────────
  test('E2: non-agency user sees blurred page content', async ({ page }) => {
    await mockFreePlan(page)
    await page.goto('/dashboard/ranking')

    // The blur overlay div should be present
    const overlay = page.locator('div.backdrop-blur-sm').first()
    await expect(overlay).toBeVisible({ timeout: 10_000 })
  })

  // ── E3: Agency user sees step 1 form ────────────────────────────────────────
  test('E3: agency user sees Job Setup step 1', async ({ page }) => {
    await mockAgencyPlan(page)
    await page.goto('/dashboard/ranking')

    await expect(page.locator('text=Job Setup')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Job Title')).toBeVisible()
  })

  // ── E4: Continue disabled when fields empty ─────────────────────────────────
  test('E4: Continue button disabled when job title or JD empty', async ({ page }) => {
    await mockAgencyPlan(page)
    await page.goto('/dashboard/ranking')
    await expect(page.locator('text=Job Setup')).toBeVisible({ timeout: 10_000 })

    const continueBtn = page.locator('button:has-text("Continue")')
    await expect(continueBtn).toBeDisabled()
  })

  // ── E5: Step 1 → Step 2 navigation ─────────────────────────────────────────
  test('E5: filling step 1 and clicking Continue advances to step 2', async ({ page }) => {
    await mockAgencyPlan(page)
    await page.goto('/dashboard/ranking')
    await expect(page.locator('text=Job Setup')).toBeVisible({ timeout: 10_000 })

    // Find the job title input in step 1 (no id set — use placeholder)
    await page.locator('input[placeholder="e.g. Senior Software Engineer"]').first().fill('Senior Engineer')
    await page.locator('textarea[placeholder*="job description"]').first().fill(
      'We need a senior engineer with strong React skills and 5 years of experience.'
    )

    await page.click('button:has-text("Continue")')
    await expect(page.locator('text=Add Candidates')).toBeVisible({ timeout: 5_000 })
  })

  // ── E6: Rank Candidates disabled until 2 candidates added ──────────────────
  test('E6: Rank Candidates button disabled with fewer than 2 candidates', async ({ page }) => {
    await mockAgencyPlan(page)
    await page.goto('/dashboard/ranking')
    await expect(page.locator('text=Job Setup')).toBeVisible({ timeout: 10_000 })

    await page.locator('input[placeholder="e.g. Senior Software Engineer"]').first().fill('Engineer')
    await page.locator('textarea[placeholder*="job description"]').first().fill('Need a good engineer.')
    await page.click('button:has-text("Continue")')

    // Only 1 candidate added → Rank button disabled
    await page.locator('input[placeholder="Full name"]').fill('Alice')
    await page.locator('textarea[placeholder*="resume text"]').fill('Alice is a great engineer with 5 years experience.')
    await page.click('button:has-text("Add Candidate")')

    const rankBtn = page.locator('button:has-text("Rank Candidates")')
    await expect(rankBtn).toBeDisabled()
  })

  // ── E7: Cannot add more than 10 candidates ──────────────────────────────────
  test('E7: Add Candidate button disables after 10 candidates', async ({ page }) => {
    await mockAgencyPlan(page)
    await page.goto('/dashboard/ranking')
    await expect(page.locator('text=Job Setup')).toBeVisible({ timeout: 10_000 })

    await page.locator('input[placeholder="e.g. Senior Software Engineer"]').first().fill('Engineer')
    await page.locator('textarea[placeholder*="job description"]').first().fill('Need great engineers.')
    await page.click('button:has-text("Continue")')

    for (let i = 1; i <= 10; i++) {
      await page.locator('input[placeholder="Full name"]').fill(`Candidate ${i}`)
      await page.locator('textarea[placeholder*="resume text"]').fill(
        `Candidate ${i} has 5 years of software engineering experience working with React.`
      )
      await page.click('button:has-text("Add Candidate")')
    }

    const addBtn = page.locator('button:has-text("Add Candidate")')
    await expect(addBtn).toBeDisabled()
  })

  // ── E8: Results leaderboard renders (mock API) ──────────────────────────────
  test('E8: ranking results show rank badges and names', async ({ page }) => {
    await mockAgencyPlan(page)
    await page.route('/api/stack-rank', async (route) => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify(MOCK_RANKING),
      })
    })
    await page.goto('/dashboard/ranking')
    await expect(page.locator('text=Job Setup')).toBeVisible({ timeout: 10_000 })

    await page.locator('input[placeholder="e.g. Senior Software Engineer"]').first().fill('Senior Engineer')
    await page.locator('textarea[placeholder*="job description"]').first().fill('Need a senior engineer with React skills.')
    await page.click('button:has-text("Continue")')

    for (const name of ['Alice Smith', 'Bob Jones']) {
      await page.locator('input[placeholder="Full name"]').fill(name)
      await page.locator('textarea[placeholder*="resume text"]').fill(`${name} has 5 years of React experience.`)
      await page.click('button:has-text("Add Candidate")')
    }

    await page.click('button:has-text("Rank Candidates")')

    await expect(page.locator('text=Alice Smith').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('text=Bob Jones').first()).toBeVisible()
    await expect(page.locator('text=#1').first()).toBeVisible()
    await expect(page.locator('text=#2').first()).toBeVisible()
  })

  // ── E9: Export CSV button present on results page ───────────────────────────
  test('E9: Export CSV button renders on results page', async ({ page }) => {
    await mockAgencyPlan(page)
    await page.route('/api/stack-rank', async (route) => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify(MOCK_RANKING),
      })
    })
    await page.goto('/dashboard/ranking')
    await expect(page.locator('text=Job Setup')).toBeVisible({ timeout: 10_000 })

    await page.locator('input[placeholder="e.g. Senior Software Engineer"]').first().fill('Senior Engineer')
    await page.locator('textarea[placeholder*="job description"]').first().fill('Need a senior engineer.')
    await page.click('button:has-text("Continue")')

    for (const name of ['Alice Smith', 'Bob Jones']) {
      await page.locator('input[placeholder="Full name"]').fill(name)
      await page.locator('textarea[placeholder*="resume text"]').fill(`${name} has strong React experience.`)
      await page.click('button:has-text("Add Candidate")')
    }

    await page.click('button:has-text("Rank Candidates")')
    await expect(page.locator('text=Alice Smith').first()).toBeVisible({ timeout: 20_000 })

    // Two Export CSV buttons (header + bottom)
    await expect(page.locator('button:has-text("Export CSV")').first()).toBeVisible()
  })

  // ── E10: Strengths and gaps render ─────────────────────────────────────────
  test('E10: candidate cards show Strengths and Gaps sections', async ({ page }) => {
    await mockAgencyPlan(page)
    await page.route('/api/stack-rank', async (route) => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify(MOCK_RANKING),
      })
    })
    await page.goto('/dashboard/ranking')
    await expect(page.locator('text=Job Setup')).toBeVisible({ timeout: 10_000 })
    await page.locator('input[placeholder="e.g. Senior Software Engineer"]').first().fill('Engineer')
    await page.locator('textarea[placeholder*="job description"]').first().fill('Good job description.')
    await page.click('button:has-text("Continue")')

    for (const name of ['Alice Smith', 'Bob Jones']) {
      await page.locator('input[placeholder="Full name"]').fill(name)
      await page.locator('textarea[placeholder*="resume text"]').fill(`${name} is a great engineer.`)
      await page.click('button:has-text("Add Candidate")')
    }
    await page.click('button:has-text("Rank Candidates")')
    await expect(page.locator('text=Alice Smith').first()).toBeVisible({ timeout: 20_000 })

    await expect(page.locator('text=STRENGTHS').first()).toBeVisible()
    await expect(page.locator('text=GAPS').first()).toBeVisible()
  })
})
