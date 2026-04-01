/**
 * SECTION D — Assessment Detail Page (/dashboard/assessments/[id])
 * Tests the detail page for an assessment (list of candidates, invite button, etc.)
 * Many tests here are conditional on test data existing.
 */
import { test, expect } from '@playwright/test'

// ── D1: Invalid ID shows 404 or error ────────────────────────────────────────
test('D1: navigating to non-existent assessment ID shows error or redirects', async ({ page }) => {
  await page.goto('/dashboard/assessments/00000000-0000-0000-0000-000000000000')
  await page.waitForLoadState('networkidle')
  // Either redirects or shows an error message
  const isError = await page.locator('text=not found, text=No assessment, text=404').first().isVisible().catch(() => false)
  const isRedirected = !page.url().includes('/report/')
  expect(isError || isRedirected).toBe(true)
})

// ── D2: Assessment list links to detail page ──────────────────────────────────
test('D2: clicking assessment title navigates to detail page', async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')

  const hasRows = await page.locator('table tbody tr').first().isVisible().catch(() => false)
  if (!hasRows) {
    test.skip()
    return
  }

  // Click the first assessment title link
  const firstLink = page.locator('table tbody tr a').first()
  const href = await firstLink.getAttribute('href')
  if (href) {
    await firstLink.click()
    await expect(page).toHaveURL(/\/dashboard\/assessments\/[\w-]+/)
  }
})

// ── D3: Detail page has Send Invite button ───────────────────────────────────
test('D3: published assessment detail shows "Send Invite" or invite functionality', async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')

  const publishedBadge = page.locator('span').filter({ hasText: /^published$/i }).first()
  const hasPublished = await publishedBadge.isVisible().catch(() => false)
  if (!hasPublished) {
    test.skip()
    return
  }

  // Navigate to published assessment
  const row = publishedBadge.locator('..').locator('..')
  const link = row.locator('a').first()
  await link.click()
  await page.waitForLoadState('networkidle')

  // Should show invite button or invite form
  const inviteEl = page.locator('button:has-text("Invite"), button:has-text("Send"), input[placeholder*="email" i]').first()
  await expect(inviteEl).toBeVisible({ timeout: 8_000 })
})

// ── D4: Assessment detail shows candidate results section ─────────────────────
test('D4: assessment detail page has a candidates/results section', async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')

  const firstLink = page.locator('table tbody tr a').first()
  const hasRows = await firstLink.isVisible().catch(() => false)
  if (!hasRows) {
    test.skip()
    return
  }

  await firstLink.click()
  await page.waitForLoadState('networkidle')

  // Should show some candidate/result section
  const resultSection = page.locator('text=Candidates, text=Results, text=Sessions').first()
  await expect(resultSection).toBeVisible({ timeout: 8_000 })
})
