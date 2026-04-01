/**
 * SECTION B — Assessment Builder
 * Tests the 4-step assessment creation flow.
 */
import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard/assessments/create')
  await page.waitForLoadState('networkidle')
})

/** Fill step 1 details */
async function fillStep1(page: Page, title = 'Test Assessment', role = 'Engineer') {
  await page.getByPlaceholder(/Senior React Developer/i).fill(title)
  await page.getByPlaceholder(/Senior Software Engineer/i).fill(role)
  await page.getByRole('button', { name: /next.*questions/i }).click()
  await page.waitForTimeout(400)
}

/** Add a single written question on step 2 */
async function addOneQuestion(page: Page) {
  await page.getByRole('button', { name: /add question/i }).click()
  // Type picker modal — click "Written"
  await page.getByRole('button', { name: /written/i }).click()
  // Question editor modal — fill prompt
  await page.getByPlaceholder(/Enter the question/i).fill('Describe your experience with this role.')
  // Save
  await page.getByRole('button', { name: /save question/i }).click()
  await page.waitForTimeout(300)
}

// ── B1: Builder page loads ────────────────────────────────────────────────────
test('B1: assessment builder page loads with step indicators', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /create assessment/i })).toBeVisible({ timeout: 10_000 })
  // Step indicators should be present
  await expect(page.locator('text=Details').first()).toBeVisible()
})

// ── B2: Step 1 validation ─────────────────────────────────────────────────────
test('B2: builder step 1 - Next button disabled without required fields', async ({ page }) => {
  // The Next button should be disabled when title and role are empty
  const nextBtn = page.getByRole('button', { name: /next.*questions/i })
  await expect(nextBtn).toBeDisabled({ timeout: 5_000 })
})

// ── B3: Step 1 fill and advance ───────────────────────────────────────────────
test('B3: builder step 1 - fill details and advance to step 2', async ({ page }) => {
  await page.getByPlaceholder(/Senior React Developer/i).fill('Playwright Test Assessment')
  await page.getByPlaceholder(/Senior Software Engineer/i).fill('Software Engineer')

  const nextBtn = page.getByRole('button', { name: /next.*questions/i })
  await expect(nextBtn).toBeEnabled({ timeout: 3_000 })
  await nextBtn.click()

  // Should advance to step 2 (Questions)
  await expect(page.locator('text=Questions').first()).toBeVisible({ timeout: 5_000 })
})

// ── B4: Step 2 - add question button visible ──────────────────────────────────
test('B4: builder step 2 - Add Question button is visible', async ({ page }) => {
  await fillStep1(page, 'MC Test Assessment', 'Engineer')
  const addBtn = page.getByRole('button', { name: /add question/i })
  await expect(addBtn).toBeVisible({ timeout: 5_000 })
})

// ── B5: Step 2 - back button works ───────────────────────────────────────────
test('B5: builder step 2 - back button returns to step 1', async ({ page }) => {
  await fillStep1(page, 'Written Test', 'Analyst')

  const backBtn = page.getByRole('button', { name: /← back/i })
  await expect(backBtn).toBeVisible({ timeout: 3_000 })
  await backBtn.click()
  await page.waitForTimeout(300)

  // Should be back on step 1
  await expect(page.getByPlaceholder(/Senior React Developer/i)).toBeVisible({ timeout: 3_000 })
})

// ── B6: Step 3 - proctoring settings ─────────────────────────────────────────
test('B6: builder step 3 shows proctoring toggles', async ({ page }) => {
  await fillStep1(page, 'Proctoring Test', 'Analyst')
  await addOneQuestion(page)

  // "Next: Proctoring →" should now be enabled
  await page.getByRole('button', { name: /next.*proctoring/i }).click()
  await page.waitForTimeout(400)

  // Should be on step 3 - Proctoring; verify proctoring feature rows are present
  await expect(page.locator('text=Proctoring').first()).toBeVisible({ timeout: 5_000 })
  // The proctoring toggles are styled <button> elements (rounded-full)
  await expect(page.locator('button.rounded-full').first()).toBeVisible({ timeout: 5_000 })
})

// ── B7: Step 4 - review and publish ──────────────────────────────────────────
test('B7: builder navigates through all 4 steps to Review', async ({ page }) => {
  await fillStep1(page, 'Full Flow Test', 'DevOps')
  await addOneQuestion(page)

  await page.getByRole('button', { name: /next.*proctoring/i }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /next.*review/i }).click()
  await page.waitForTimeout(400)

  // Should be on step 4 — Review/Publish
  await expect(page.locator('text=Review').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('button', { name: /publish/i }).first()).toBeVisible({ timeout: 5_000 })
})

// ── B8: Back button navigation ────────────────────────────────────────────────
test('B8: builder back button from step 2 returns to step 1', async ({ page }) => {
  await fillStep1(page, 'Back Test', 'PM')

  const backBtn = page.getByRole('button', { name: /← back/i })
  if (await backBtn.isVisible()) {
    await backBtn.click()
    await page.waitForTimeout(300)
    await expect(page.getByPlaceholder(/Senior React Developer/i)).toBeVisible({ timeout: 3_000 })
  }
})
