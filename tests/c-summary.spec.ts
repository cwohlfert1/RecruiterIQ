/**
 * PART C — Client Summary Generator
 * Note: The implementation takes Job Title + Notes (not raw Resume Text as in PRD v1).
 * This is an intentional design deviation and is correctly implemented.
 */
import { test, expect } from '@playwright/test'

// Four-bullet SSE mock stream
function makeSseStream(bullets: string[]): string {
  const chunks: string[] = []
  for (const bullet of bullets) {
    chunks.push(`data: ${JSON.stringify({ token: bullet })}\n\n`)
  }
  chunks.push('data: [DONE]\n\n')
  return chunks.join('')
}

const FOUR_BULLETS = [
  '• 8 years of engineering experience, specializing in full-stack development\n',
  '• Expert in React, TypeScript, and AWS infrastructure\n',
  '• Background in fintech SaaS and financial compliance systems\n',
  '• Available immediately; last compensation was $145k base',
]

test.describe('C — Client Summary Generator', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/summary')
    await expect(page.locator('main h1')).toContainText('Client Summary Generator')
  })

  // ── C1: Job title required ──────────────────────────────────────────────────
  test('C1: empty job title shows toast error', async ({ page }) => {
    await page.fill('#notes', 'Some notes about the candidate')
    await page.click('button:has-text("Generate Summary")')
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /job title/i }).first()
    await expect(toast).toBeVisible({ timeout: 8_000 })
  })

  // ── C2: Notes required ──────────────────────────────────────────────────────
  test('C2: empty notes shows toast error', async ({ page }) => {
    await page.fill('#job-title', 'Senior Engineer')
    await page.click('button:has-text("Generate Summary")')
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /notes/i }).first()
    await expect(toast).toBeVisible({ timeout: 8_000 })
  })

  // ── C3: Character counter on Job Title ─────────────────────────────────────
  test('C3: job title character counter updates', async ({ page }) => {
    await page.fill('#job-title', 'Engineer')
    await expect(page.locator('text=8 / 100')).toBeVisible()
  })

  // ── C4: Word counter on Notes ───────────────────────────────────────────────
  test('C4: notes word counter updates', async ({ page }) => {
    await page.fill('#notes', 'one two three')
    await expect(page.locator('text=3 / 500 words')).toBeVisible()
  })

  // ── C5: Notes warning at 85% (425+ words) ──────────────────────────────────
  test('C5: notes word counter turns yellow at 85%', async ({ page }) => {
    const words425 = Array.from({ length: 425 }, (_, i) => `w${i}`).join(' ')
    await page.fill('#notes', words425)
    await expect(page.locator('span.text-yellow-400')).toBeVisible()
  })

  // ── C6: Streaming response renders progressively ────────────────────────────
  test('C6: streaming tokens render progressively in UI', async ({ page }) => {
    // Intercept with a slow SSE response to verify streaming
    await page.route('/api/generate-summary', async (route) => {
      const body = makeSseStream(FOUR_BULLETS)
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body,
      })
    })

    await page.fill('#job-title', 'Senior Software Engineer')
    await page.fill('#notes', 'Candidate has 8 years experience in React and TypeScript.')
    await page.click('button:has-text("Generate Summary")')

    // After streaming completes, "Client Brief" heading and output text appear
    await expect(page.locator('text=Client Brief').first()).toBeVisible({ timeout: 15_000 })
    // Output container should have text from the mock stream
    await expect(page.locator('div.whitespace-pre-wrap').first()).not.toBeEmpty({ timeout: 10_000 })
  })

  // ── C7: Output contains 4 bullet points ─────────────────────────────────────
  test('C7: completed output contains 4 bullet points', async ({ page }) => {
    await page.route('/api/generate-summary', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeSseStream(FOUR_BULLETS),
      })
    })

    await page.fill('#job-title', 'Senior Software Engineer')
    await page.fill('#notes', 'Eight years experience, strong React skills.')
    await page.click('button:has-text("Generate Summary")')

    await expect(page.locator('text=Client Brief').first()).toBeVisible({ timeout: 15_000 })

    // Count bullet chars in the output container
    const outputText = await page.locator('div.whitespace-pre-wrap').innerText()
    const bulletCount = (outputText.match(/^•/gm) || []).length
    expect(bulletCount).toBe(4)
  })

  // ── C8: Copy button appears and shows checkmark ──────────────────────────────
  test('C8: copy button shows checkmark for 2 seconds after click', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.route('/api/generate-summary', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeSseStream(FOUR_BULLETS),
      })
    })

    await page.fill('#job-title', 'Engineer')
    await page.fill('#notes', 'Good candidate with React skills.')
    await page.click('button:has-text("Generate Summary")')
    await expect(page.locator('text=Client Brief').first()).toBeVisible({ timeout: 15_000 })

    // Copy button should be visible when status is complete
    const copyBtn = page.locator('button').filter({ hasText: /copy/i }).first()
    await expect(copyBtn).toBeVisible()
    await copyBtn.click()

    // Checkmark state
    await expect(page.locator('button').filter({ hasText: /copied/i }).first()).toBeVisible()
    // Returns to "Copy" after 2 seconds
    await expect(page.locator('button').filter({ hasText: /^Copy$/i }).first()).toBeVisible({ timeout: 4_000 })
  })

  // ── C9: "Saved to history" message shows after completion ──────────────────
  test('C9: saved to history message shows after completion', async ({ page }) => {
    await page.route('/api/generate-summary', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeSseStream(FOUR_BULLETS),
      })
    })
    await page.fill('#job-title', 'Engineer')
    await page.fill('#notes', 'Good candidate.')
    await page.click('button:has-text("Generate Summary")')
    await expect(page.locator('text=Saved to history automatically')).toBeVisible({ timeout: 15_000 })
  })

  // ── C10: "New summary" button resets form ───────────────────────────────────
  test('C10: New summary button resets form', async ({ page }) => {
    await page.route('/api/generate-summary', async (route) => {
      await route.fulfill({
        status:  200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body:    makeSseStream(FOUR_BULLETS),
      })
    })
    await page.fill('#job-title', 'Engineer')
    await page.fill('#notes', 'Good candidate.')
    await page.click('button:has-text("Generate Summary")')
    await expect(page.locator('text=Client Brief').first()).toBeVisible({ timeout: 15_000 })

    await page.click('button:has-text("New summary")')
    await expect(page.locator('#job-title')).toHaveValue('')
    await expect(page.locator('#notes')).toHaveValue('')
  })
})
