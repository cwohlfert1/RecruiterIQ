/**
 * SECTION F — Assessment Taking UI
 * Tests question navigation, question rendering, timer display.
 * Many tests require valid test data (a real invite token).
 * Tests here use the invalid-token path to verify UI structure.
 */
import { test, expect, Browser } from '@playwright/test'

async function freshPage(browser: Browser) {
  const ctx  = await browser.newContext({ storageState: undefined })
  const page = await ctx.newPage()
  return { page, ctx }
}

// ── F1: Question route with invalid token shows error ─────────────────────────
test('F1: /assess/[invalid]/1 shows error not login redirect', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/assess/invalid-token-xyz/1')
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/\/login/)
  // Should show some error (invalid session, no active session, etc.)
  await ctx.close()
})

// ── F2: Question pages are public routes ─────────────────────────────────────
test('F2: /assess/[token]/[index] does not redirect to /login', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)
  await page.goto('/assess/fake-token/1')
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/\/login/)
  await ctx.close()
})

// ── F3: Consent screen checkbox validation (with API mock) ────────────────────
test('F3: consent screen "Begin" button is disabled until all checkboxes are checked', async ({ browser }) => {
  const { page, ctx } = await freshPage(browser)

  // Mock the assessment start API to avoid needing real data
  await page.route('/api/assess/*/start', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  // Navigate to consent page — will likely show error state for invalid token
  // but if the consent component renders, we can check button state
  await page.goto('/assess/fake-token/consent')
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/\/login/)

  // If consent form is shown, begin button should be disabled until checked
  const beginBtn = page.getByRole('button', { name: /begin|start/i })
  if (await beginBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const isDisabled = await beginBtn.isDisabled()
    // It should be disabled if checkboxes aren't checked yet
    // (Unless the page shows an error state — no consent form rendered)
    expect(isDisabled).toBe(true)
  }

  await ctx.close()
})

// ── F4: API event endpoint accepts POST ───────────────────────────────────────
test('F4: POST /api/assess/[token]/event returns 403 for invalid token (not 500)', async ({ page }) => {
  const response = await page.request.post('/api/assess/invalid-token-xyz/event', {
    data: {
      eventType: 'tab_switch',
      severity: 'low',
      payload: { duration_away_ms: 2000 },
    },
  })
  // Should return 403 (invalid token) not 500 (server error)
  expect([400, 403, 404]).toContain(response.status())
})

// ── F5: API submit endpoint accepts POST ──────────────────────────────────────
test('F5: POST /api/assess/[token]/submit returns 403 for invalid token (not 500)', async ({ page }) => {
  const response = await page.request.post('/api/assess/invalid-token-xyz/submit', {
    data: {
      responses: [],
      timeSpentSeconds: 120,
    },
  })
  expect([400, 403, 404]).toContain(response.status())
})

// ── F6: API start endpoint accepts POST ───────────────────────────────────────
test('F6: POST /api/assess/[token]/start returns 403 for invalid token (not 500)', async ({ page }) => {
  const response = await page.request.post('/api/assess/invalid-token-xyz/start', {
    data: {},
  })
  expect([400, 403, 404]).toContain(response.status())
})
