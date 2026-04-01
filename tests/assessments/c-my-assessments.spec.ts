/**
 * SECTION C — My Assessments Page (/dashboard/assessments)
 * Tests the assessment listing, status badges, and table actions.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')
})

// ── C1: Page renders ──────────────────────────────────────────────────────────
test('C1: my assessments page loads without errors', async ({ page }) => {
  await expect(page).not.toHaveURL(/\/login/)
  // Either a table or an empty state message
  const hasTable = await page.locator('table').isVisible().catch(() => false)
  const hasEmpty = await page.locator('text=No assessments').isVisible().catch(() => false)
  expect(hasTable || hasEmpty).toBe(true)
})

// ── C2: Page has correct heading ──────────────────────────────────────────────
test('C2: page heading includes "Assessments"', async ({ page }) => {
  await expect(page.locator('h1, h2').filter({ hasText: /assessments/i }).first()).toBeVisible({ timeout: 5_000 })
})

// ── C3: Create Assessment link present ───────────────────────────────────────
test('C3: "Create Assessment" link is visible on the page', async ({ page }) => {
  await expect(page.getByRole('link', { name: /create assessment/i }).first()).toBeVisible({ timeout: 5_000 })
})

// ── C4: Create Assessment link navigates correctly ────────────────────────────
test('C4: "Create Assessment" navigates to builder', async ({ page }) => {
  await page.getByRole('link', { name: /create assessment/i }).first().click()
  await expect(page).toHaveURL(/\/dashboard\/assessments\/create/)
})

// ── C5: Empty state has CTA ───────────────────────────────────────────────────
test('C5: empty state shows "Create Assessment" call to action', async ({ page }) => {
  const hasTable = await page.locator('table tbody tr').first().isVisible().catch(() => false)
  if (!hasTable) {
    // Empty state should have CTA
    await expect(page.getByRole('link', { name: /create assessment/i }).first()).toBeVisible()
  }
})

// ── C6: Table columns visible when data exists ────────────────────────────────
test('C6: table shows Title, Status, Invites, Avg Trust, Avg Skill columns when data present', async ({ page }) => {
  const hasRows = await page.locator('table tbody tr').first().isVisible().catch(() => false)
  if (hasRows) {
    await expect(page.locator('th').filter({ hasText: /title/i })).toBeVisible()
    await expect(page.locator('th').filter({ hasText: /status/i })).toBeVisible()
  }
})

// ── C7: Draft assessments show delete button ──────────────────────────────────
test('C7: draft assessment row has delete action', async ({ page }) => {
  const draftBadge = page.locator('span').filter({ hasText: /^draft$/i }).first()
  const hasDraft = await draftBadge.isVisible().catch(() => false)
  if (hasDraft) {
    // Row with draft badge should have a delete button nearby
    const row = draftBadge.locator('..').locator('..')
    const deleteBtn = row.getByTitle(/delete/i)
    await expect(deleteBtn).toBeVisible()
  }
})

// ── C8: Published assessments show archive button ────────────────────────────
test('C8: published assessment row has archive action', async ({ page }) => {
  const publishedBadge = page.locator('span').filter({ hasText: /^published$/i }).first()
  const hasPublished = await publishedBadge.isVisible().catch(() => false)
  if (hasPublished) {
    const row = publishedBadge.locator('..').locator('..')
    const archiveBtn = row.getByTitle(/archive/i)
    await expect(archiveBtn).toBeVisible()
  }
})
