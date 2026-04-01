/**
 * SECTION H — Proctoring Report (/dashboard/assessments/[id]/report/[sessionId])
 * Tests the full proctoring report page rendering.
 */
import { test, expect } from '@playwright/test'

// ── H1: Report page requires authentication ───────────────────────────────────
test('H1: report page redirects unauthenticated users to /login', async ({ browser }) => {
  const ctx  = await browser.newContext({ storageState: undefined })
  const page = await ctx.newPage()
  await page.goto('/dashboard/assessments/fake-id/report/fake-session')
  await expect(page).toHaveURL(/\/login/)
  await ctx.close()
})

// ── H2: Report with invalid IDs shows error (not 500) ────────────────────────
test('H2: report page with invalid IDs shows not-found state, not server error', async ({ page }) => {
  await page.goto('/dashboard/assessments/00000000-0000-0000-0000-000000000000/report/00000000-0000-0000-0000-000000000000')
  await page.waitForLoadState('networkidle')
  // Should not be a server error — should be a graceful not found
  const isServerError = await page.locator('text=500, text=Internal Server Error').isVisible().catch(() => false)
  expect(isServerError).toBe(false)
})

// ── H3: Valid report link from assessment detail navigates to report ───────────
test('H3: report link on assessment detail navigates to report page', async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')

  const firstRow = page.locator('table tbody tr').first()
  const hasRows = await firstRow.isVisible().catch(() => false)
  if (!hasRows) {
    test.skip()
    return
  }

  const link = firstRow.locator('a').first()
  await link.click()
  await page.waitForLoadState('networkidle')

  // Look for a "View Report" or "Report" link on the detail page
  const reportLink = page.getByRole('link', { name: /report|view/i }).first()
  const hasReportLink = await reportLink.isVisible().catch(() => false)
  if (hasReportLink) {
    await reportLink.click()
    await expect(page).toHaveURL(/\/report\//)
  }
})

// ── H4: Report shows key sections ────────────────────────────────────────────
test('H4: report page with data shows trust score and skill score sections', async ({ page }) => {
  // Navigate to a real report if one exists
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')

  // Find a completed session link if any
  const reportLinks = page.locator('a[href*="/report/"]')
  const hasReport = await reportLinks.first().isVisible().catch(() => false)
  if (!hasReport) {
    test.skip()
    return
  }

  await reportLinks.first().click()
  await page.waitForLoadState('networkidle')

  // Should show Trust Score and Skill Score
  await expect(page.locator('text=Trust Score').first()).toBeVisible({ timeout: 8_000 })
  await expect(page.locator('text=Skill Score').first()).toBeVisible({ timeout: 8_000 })
})

// ── H5: Report shows proctoring timeline section ──────────────────────────────
test('H5: report page shows proctoring events section', async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')

  const reportLinks = page.locator('a[href*="/report/"]')
  const hasReport = await reportLinks.first().isVisible().catch(() => false)
  if (!hasReport) {
    test.skip()
    return
  }

  await reportLinks.first().click()
  await page.waitForLoadState('networkidle')

  // Should show some proctoring section
  const proctoringSection = page.locator('text=Proctoring, text=Timeline, text=Events').first()
  await expect(proctoringSection).toBeVisible({ timeout: 8_000 })
})

// ── H6: Export PDF button present ────────────────────────────────────────────
test('H6: report page has Export PDF button', async ({ page }) => {
  const reportLinks = page.locator('a[href*="/report/"]')

  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')

  const hasReport = await reportLinks.first().isVisible().catch(() => false)
  if (!hasReport) {
    test.skip()
    return
  }

  await reportLinks.first().click()
  await page.waitForLoadState('networkidle')

  const exportBtn = page.getByRole('button', { name: /export|pdf/i })
  await expect(exportBtn).toBeVisible({ timeout: 5_000 })
})
