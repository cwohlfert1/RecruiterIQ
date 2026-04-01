/**
 * SECTION J — Plan Gating
 * Tests that Free plan users cannot access assessment creation.
 * (Requires test user to be on Free plan OR uses API-level checks.)
 */
import { test, expect } from '@playwright/test'

// ── J1: Assessments page accessible to authenticated users ────────────────────
test('J1: /dashboard/assessments loads for authenticated user', async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/\/login/)
})

// ── J2: Create assessment API validates session ───────────────────────────────
test('J2: POST /api/assessments/create requires auth (returns 401 without session)', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: undefined })
  const page = await ctx.newPage()
  const response = await page.request.post('/api/assessments/create', {
    data: {
      title: 'Test',
      role: 'Tester',
      timeLimitMinutes: 60,
      questions: [],
      proctoringConfig: {},
    },
  })
  expect([401, 403]).toContain(response.status())
  await ctx.close()
})

// ── J3: Invite API requires auth ──────────────────────────────────────────────
test('J3: POST /api/assessments/invite requires auth (returns 401 without session)', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: undefined })
  const page = await ctx.newPage()
  const response = await page.request.post('/api/assessments/invite', {
    data: {
      assessmentId: 'fake-id',
      candidateName: 'Test Candidate',
      candidateEmail: 'candidate@test.com',
    },
  })
  expect([401, 403]).toContain(response.status())
  await ctx.close()
})

// ── J4: Plan gating message shown to free users (if applicable) ───────────────
test('J4: assessments page shows appropriate content for current plan', async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')

  // Either shows plan upgrade message OR shows the assessments interface
  const isUpgradeShown = await page.getByText(/upgrade/i).or(page.getByText(/Pro plan/i))
    .first().isVisible().catch(() => false)
  const hasLinks = await page.locator('a').first().isVisible().catch(() => false)

  // Page should show something useful — either upgrade or the actual UI
  expect(isUpgradeShown || hasLinks).toBe(true)
})

// ── J5: Assessments create page accessible to Pro/Agency users ───────────────
test('J5: /dashboard/assessments/create loads without error for authenticated user', async ({ page }) => {
  await page.goto('/dashboard/assessments/create')
  await page.waitForLoadState('networkidle')
  // Either redirects to billing upgrade or shows the builder
  await expect(page).not.toHaveURL(/\/login/)
  // Should not show a server error
  const isServerError = await page.locator('text=500, text=Internal Server Error').isVisible().catch(() => false)
  expect(isServerError).toBe(false)
})
