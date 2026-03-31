/**
 * PART F — History Page
 */
import { test, expect } from '@playwright/test'

test.describe('F — History Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/history')
    await expect(page.locator('h1, h2').filter({ hasText: /history/i }).first()).toBeVisible()
  })

  // ── F1: All 4 tabs render ───────────────────────────────────────────────────
  test('F1: all 4 history tabs are present', async ({ page }) => {
    await expect(page.locator('button').filter({ hasText: /Resume Scores/i })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: /Summaries/i })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: /Boolean Strings/i })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: /Stack Rankings/i })).toBeVisible()
  })

  // ── F2: Clicking tabs switches content ──────────────────────────────────────
  test('F2: clicking Summaries tab activates it', async ({ page }) => {
    await page.click('button:has-text("Summaries")')
    // After switching, the active tab should be Summaries
    const activeTab = page.locator('button').filter({ hasText: /Summaries/i })
    await expect(activeTab).toHaveClass(/text-white|text-indigo/, { timeout: 3_000 })
  })

  test('F3: clicking Boolean Strings tab activates it', async ({ page }) => {
    await page.click('button:has-text("Boolean Strings")')
    const activeTab = page.locator('button').filter({ hasText: /Boolean Strings/i })
    await expect(activeTab).toHaveClass(/text-white|text-indigo/, { timeout: 3_000 })
  })

  // ── F4: Search input exists ─────────────────────────────────────────────────
  test('F4: search input is present on the history page', async ({ page }) => {
    await expect(page.locator('input[type="text"][placeholder*="search" i], input[type="search"]').first()).toBeVisible()
  })

  // ── F5: Search filters results ──────────────────────────────────────────────
  test('F5: search input filters visible rows', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i]').first()

    // Type something unlikely to match — should reduce rows
    await searchInput.fill('zzz_no_match_xyz')

    // Wait briefly for debounce
    await page.waitForTimeout(500)

    // Either no rows, or an empty state message is shown
    const rows  = page.locator('tr, [role="row"]').filter({ hasNot: page.locator('th') })
    const count = await rows.count()

    const emptyState = page.locator('text=No results').or(page.locator('text=no history').or(page.locator('text=Nothing here')))
    const hasEmpty   = await emptyState.isVisible({ timeout: 3_000 }).catch(() => false)

    expect(count === 0 || hasEmpty).toBeTruthy()
  })

  // ── F6: Pagination next/prev controls exist when there is data ──────────────
  test('F6: pagination controls exist (if more than 20 rows)', async ({ page }) => {
    // Pagination renders "Previous"/"Next" buttons only when totalCount > PAGE_SIZE
    // Check how many rows are visible — if any, verify the buttons render
    const rows = await page.locator('tbody tr').count()
    if (rows > 0) {
      // With data, pagination footer renders (buttons may be disabled but visible)
      const prevBtn = page.locator('button:has-text("Previous")')
      const nextBtn = page.locator('button:has-text("Next")')
      const hasNext = await nextBtn.count()
      const hasPrev = await prevBtn.count()
      expect(hasNext + hasPrev).toBeGreaterThan(0)
    }
    // If no rows, pagination doesn't render — test passes trivially
  })

  // ── F7: Empty state shown for new account ───────────────────────────────────
  test('F7: empty state shown when no history data exists', async ({ page }) => {
    // Navigate to Boolean tab (likely empty for test account)
    await page.click('button:has-text("Boolean Strings")')
    await page.waitForTimeout(1_000) // wait for data fetch

    const rows = await page.locator('tr:not(:first-child), tbody tr').count()

    if (rows === 0) {
      // Should show an empty state — look for generic empty indicators
      // EmptyState renders "No boolean strings yet"
      const emptyMsg = page.locator('text=No boolean strings yet')
      const found = await emptyMsg.isVisible({ timeout: 2_000 }).catch(() => false)
      expect(found).toBeTruthy()
    }
    // If rows exist, this test passes trivially — data is present
  })
})
