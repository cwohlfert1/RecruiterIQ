/**
 * PART D — Boolean String Generator
 * ⚠️  PRD DISCREPANCY NOTED:
 *   PRD specifies two output cards (LinkedIn + Indeed) with individual copy buttons.
 *   Implementation has ONE output card with ONE copy button.
 *   Tests D9 and D10 check per-spec (two cards) and will flag if not present.
 */
import { test, expect } from '@playwright/test'

const BOOLEAN_OUTPUT =
  '"Senior Engineer" AND ("React" OR "Vue") AND "TypeScript" NOT "Manager"'

function makeBooleanSse(text: string): string {
  // Send in small chunks to simulate streaming
  const chunks = text.split(' ').map(word =>
    `data: ${JSON.stringify({ token: word + ' ' })}\n\n`
  )
  chunks.push('data: [DONE]\n\n')
  return chunks.join('')
}

// Helper: add a tag in a TagInput section
async function addTag(page: import('@playwright/test').Page, labelText: string, tagValue: string) {
  const section = page.locator('div.space-y-2').filter({ hasText: labelText }).first()
  const input = section.locator('input[type="text"]')
  await input.fill(tagValue)
  await section.locator('button:has-text("Add")').click()
}

test.describe('D — Boolean String Generator', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/boolean')
    await expect(page.locator('main h1')).toContainText('Boolean String Generator')
  })

  // ── D1: Job title required ──────────────────────────────────────────────────
  test('D1: empty job title shows inline error', async ({ page }) => {
    // Add a required skill so that's not the blocker
    await addTag(page, 'Required Skills', 'React')
    await page.click('button:has-text("Generate Boolean String")')
    await expect(page.locator('text=Job title is required')).toBeVisible()
  })

  // ── D2: Required skills required ────────────────────────────────────────────
  test('D2: no required skills shows inline error', async ({ page }) => {
    await page.fill('#job-title', 'Software Engineer')
    await page.click('button:has-text("Generate Boolean String")')
    await expect(page.locator('text=Add at least one required skill')).toBeVisible()
  })

  // ── D3: Optional fields are truly optional ──────────────────────────────────
  test('D3: optional fields not required — can submit with only required', async ({ page }) => {
    await page.route('/api/generate-boolean', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeBooleanSse(BOOLEAN_OUTPUT),
      })
    })

    await page.fill('#job-title', 'Software Engineer')
    await addTag(page, 'Required Skills', 'React')
    // Leave Optional Skills, Location, Exclusions empty
    await page.click('button:has-text("Generate Boolean String")')

    // Should NOT show errors — should start generating
    await expect(page.locator('text=Job title is required')).not.toBeVisible()
    await expect(page.locator('text=Add at least one required skill')).not.toBeVisible()
  })

  // ── D4: Tags can be added and removed ──────────────────────────────────────
  test('D4: adding a tag shows it as chip with remove button', async ({ page }) => {
    await addTag(page, 'Required Skills', 'TypeScript')
    const chip = page.locator('span.glass').filter({ hasText: 'TypeScript' })
    await expect(chip).toBeVisible()

    // Remove it
    await chip.locator('button[aria-label="Remove TypeScript"]').click()
    await expect(chip).not.toBeVisible()
  })

  // ── D5: Max 10 tags — input disables at max ─────────────────────────────────
  test('D5: Required Skills input disables after 10 tags', async ({ page }) => {
    for (let i = 1; i <= 10; i++) {
      await addTag(page, 'Required Skills', `Skill${i}`)
    }
    const section = page.locator('div.space-y-2').filter({ hasText: 'Required Skills' }).first()
    const input = section.locator('input[type="text"]')
    await expect(input).toBeDisabled()
    await expect(input).toHaveAttribute('placeholder', /max 10 reached/i)
  })

  // ── D6: Boolean output renders with syntax highlighting ─────────────────────
  test('D6: AND operator highlighted in indigo in output', async ({ page }) => {
    await page.route('/api/generate-boolean', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeBooleanSse('"React" AND "TypeScript" NOT "Manager"'),
      })
    })

    await page.fill('#job-title', 'Engineer')
    await addTag(page, 'Required Skills', 'React')
    await page.click('button:has-text("Generate Boolean String")')

    // Wait for completion
    const copyBtn = page.locator('button').filter({ hasText: /^Copy$/i }).first()
    await expect(copyBtn).toBeVisible({ timeout: 15_000 })

    // Check for indigo-highlighted AND
    const andHighlight = page.locator('span.text-indigo-400').filter({ hasText: 'AND' }).first()
    await expect(andHighlight).toBeVisible()
  })

  test('D7: NOT operator highlighted in output', async ({ page }) => {
    await page.route('/api/generate-boolean', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeBooleanSse('"React" AND "TypeScript" NOT "Manager"'),
      })
    })
    await page.fill('#job-title', 'Engineer')
    await addTag(page, 'Required Skills', 'React')
    await page.click('button:has-text("Generate Boolean String")')
    await expect(page.locator('button').filter({ hasText: /^Copy$/i }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('span.text-indigo-400').filter({ hasText: 'NOT' }).first()).toBeVisible()
  })

  // ── D8: Single copy button (mock) + animation ───────────────────────────────
  test('D8: copy button shows Copied! after click', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.route('/api/generate-boolean', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeBooleanSse(BOOLEAN_OUTPUT),
      })
    })
    await page.fill('#job-title', 'Engineer')
    await addTag(page, 'Required Skills', 'React')
    await page.click('button:has-text("Generate Boolean String")')
    await expect(page.locator('button').filter({ hasText: /^Copy$/i }).first()).toBeVisible({ timeout: 15_000 })
    await page.locator('button').filter({ hasText: /^Copy$/i }).first().click()
    await expect(page.locator('button').filter({ hasText: /Copied!/i }).first()).toBeVisible()
  })

  // ── D9: PRD SPEC CHECK — Two output cards (LinkedIn + Indeed) ───────────────
  // ⚠️  EXPECTED FAIL: Implementation has ONE card. PRD says two.
  test('D9 [SPEC]: two output cards exist — LinkedIn and Indeed', async ({ page }) => {
    test.fail(true, 'PRD specifies two output cards (LinkedIn/Indeed) but implementation has one combined output card. See d-boolean.spec.ts D9 for details.')

    await page.route('/api/generate-boolean', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeBooleanSse(BOOLEAN_OUTPUT),
      })
    })
    await page.fill('#job-title', 'Engineer')
    await addTag(page, 'Required Skills', 'React')
    await page.click('button:has-text("Generate Boolean String")')

    await expect(page.locator('text=LinkedIn')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Indeed')).toBeVisible()
  })

  // ── D10: PRD SPEC CHECK — Individual copy button per card ───────────────────
  // ⚠️  EXPECTED FAIL: Same reason as D9 — one card, one copy button.
  test('D10 [SPEC]: two individual copy buttons (one per output card)', async ({ page }) => {
    test.fail(true, 'PRD specifies individual copy buttons per output card. Implementation has one combined copy button.')

    await page.route('/api/generate-boolean', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeBooleanSse(BOOLEAN_OUTPUT),
      })
    })
    await page.fill('#job-title', 'Engineer')
    await addTag(page, 'Required Skills', 'React')
    await page.click('button:has-text("Generate Boolean String")')
    const copyBtns = page.locator('button').filter({ hasText: /copy/i })
    await expect(copyBtns).toHaveCount(2, { timeout: 15_000 })
  })

  // ── D11: New Search resets form ─────────────────────────────────────────────
  test('D11: New Search button resets form', async ({ page }) => {
    await page.route('/api/generate-boolean', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeBooleanSse(BOOLEAN_OUTPUT),
      })
    })
    await page.fill('#job-title', 'Engineer')
    await addTag(page, 'Required Skills', 'React')
    await page.click('button:has-text("Generate Boolean String")')
    await expect(page.locator('button').filter({ hasText: /^Copy$/i }).first()).toBeVisible({ timeout: 15_000 })
    await page.click('button:has-text("New Search")')
    await expect(page.locator('#job-title')).toHaveValue('')
  })
})
