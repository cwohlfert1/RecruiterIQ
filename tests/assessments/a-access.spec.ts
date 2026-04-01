/**
 * SECTION A — Role & Access Control
 * Tests that protected assessment routes redirect unauthenticated users
 * and that candidate-facing /assess/* routes are publicly accessible.
 */
import { test, expect, Browser } from '@playwright/test'

async function freshPage(browser: Browser) {
  const ctx  = await browser.newContext({ storageState: undefined })
  const page = await ctx.newPage()
  return { page, ctx }
}

// ── A1: Dashboard routes require auth ─────────────────────────────────────────
test('A1: /dashboard/assessments redirects unauthenticated users to /login', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/dashboard/assessments')
  await expect(page).toHaveURL(/\/login/)
  await ctx.close()
})

test('A2: /dashboard/assessments/create redirects unauthenticated users to /login', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/dashboard/assessments/create')
  await expect(page).toHaveURL(/\/login/)
  await ctx.close()
})

test('A3: /dashboard/assessments/[id] redirects unauthenticated users to /login', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/dashboard/assessments/fake-id-12345')
  await expect(page).toHaveURL(/\/login/)
  await ctx.close()
})

test('A4: /dashboard/assessments/[id]/report/[sessionId] redirects unauthenticated users to /login', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/dashboard/assessments/fake-id/report/fake-session')
  await expect(page).toHaveURL(/\/login/)
  await ctx.close()
})

// ── A5: Candidate routes are publicly accessible ──────────────────────────────
test('A5: /assess/[invalid-token] is publicly accessible (no redirect to login)', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/assess/invalid-token-xyz')
  // Should NOT redirect to /login — it's a public route
  await expect(page).not.toHaveURL(/\/login/)
  await ctx.close()
})

// ── A6: Authenticated users can access dashboard/assessments ──────────────────
test('A6: authenticated user can access /dashboard/assessments', async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await expect(page).not.toHaveURL(/\/login/)
  // Should show assessments page heading
  await expect(page.locator('h1, h2').filter({ hasText: /assessments/i }).first()).toBeVisible({ timeout: 10_000 })
})

// ── A7: Assessments link visible in sidebar ───────────────────────────────────
test('A7: authenticated sidebar shows Assessments navigation link', async ({ page }) => {
  await page.goto('/dashboard')
  const assessmentsLink = page.getByRole('link', { name: /assessments/i }).first()
  await expect(assessmentsLink).toBeVisible({ timeout: 10_000 })
})

// ── A8: Create assessment link in sidebar ────────────────────────────────────
test('A8: assessments page has "Create Assessment" action', async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await expect(page.getByRole('link', { name: /create assessment/i }).first()).toBeVisible({ timeout: 10_000 })
})
