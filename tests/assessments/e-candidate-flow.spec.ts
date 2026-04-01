/**
 * SECTION E — Candidate Assessment Flow (Public Routes)
 * Tests /assess/[token] landing, consent, and complete pages.
 * These are PUBLIC routes — no authentication needed.
 */
import { test, expect, Browser } from '@playwright/test'

async function freshPage(browser: Browser) {
  const ctx  = await browser.newContext({ storageState: undefined })
  const page = await ctx.newPage()
  return { page, ctx }
}

// ── E1: Invalid token shows error state ──────────────────────────────────────
test('E1: /assess/invalid-token shows error or expired state (not login)', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/assess/totally-invalid-token-xyz-123')
  await page.waitForLoadState('networkidle')
  // Should NOT redirect to login
  await expect(page).not.toHaveURL(/\/login/)
  // Should show some error/not-found state (Next.js 404 or custom error page)
  const errorState = page.getByText(/invalid/i).or(page.getByText(/expired/i))
    .or(page.getByText(/not found/i)).or(page.getByText(/404/))
  await expect(errorState.first()).toBeVisible({ timeout: 10_000 })
  await ctx.close()
})

// ── E2: Landing page is public ────────────────────────────────────────────────
test('E2: /assess/* routes load without auth redirect', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/assess/test-token-123')
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/\/login/)
  await ctx.close()
})

// ── E3: Consent page with invalid token ──────────────────────────────────────
test('E3: /assess/[invalid-token]/consent is publicly accessible', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/assess/invalid-token-xyz/consent')
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/\/login/)
  await ctx.close()
})

// ── E4: Complete page with invalid token ─────────────────────────────────────
test('E4: /assess/[invalid-token]/complete is publicly accessible', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/assess/invalid-token-xyz/complete')
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/\/login/)
  await ctx.close()
})

// ── E5: Light theme on candidate pages ───────────────────────────────────────
test('E5: candidate pages use light theme (not dark dashboard)', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/assess/invalid-token-xyz')
  await page.waitForLoadState('networkidle')
  // Body or root element should not have dark theme class
  const bodyBg = await page.evaluate(() => {
    const body = document.body
    const styles = window.getComputedStyle(body)
    return styles.backgroundColor
  })
  // White or light background (not the dark #0f172a dashboard bg)
  // The candidate layout applies bg-white
  const htmlClass = await page.evaluate(() => document.documentElement.className)
  // Should not have the same dark theme as dashboard
  expect(bodyBg).not.toBe('rgb(15, 23, 42)') // #0f172a is the dark bg
  await ctx.close()
})

// ── E6: Completion screen renders ─────────────────────────────────────────────
test('E6: /assess/[token]/complete renders a completion confirmation page', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/assess/any-token/complete')
  await page.waitForLoadState('networkidle')
  // Should render something meaningful (not blank or redirect to login)
  await expect(page).not.toHaveURL(/\/login/)
  // The completion screen shows "Assessment Complete!" or similar text
  const completionText = page.getByText(/Assessment Complete/i)
    .or(page.getByText(/submitted/i))
    .or(page.getByText(/thank you/i))
  await expect(completionText.first()).toBeVisible({ timeout: 8_000 })
  await ctx.close()
})
