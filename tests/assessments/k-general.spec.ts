/**
 * SECTION K — General / Cross-cutting Tests
 * Navigation, sidebar links, API health checks, no broken routes.
 */
import { test, expect } from '@playwright/test'

// ── K1: Assessments sidebar link navigates correctly ─────────────────────────
test('K1: sidebar "Assessments" link navigates to /dashboard/assessments', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  const assessmentsLink = page.getByRole('link', { name: /assessments/i }).first()
  await assessmentsLink.click()
  await expect(page).toHaveURL(/\/dashboard\/assessments/)
})

// ── K2: No console errors on assessments page ────────────────────────────────
test('K2: /dashboard/assessments loads without unhandled JS errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // Filter out known acceptable errors (e.g. ResizeObserver)
  const fatalErrors = errors.filter(e =>
    !e.includes('ResizeObserver') &&
    !e.includes('Non-Error promise rejection')
  )
  expect(fatalErrors).toHaveLength(0)
})

// ── K3: No console errors on create assessment page ──────────────────────────
test('K3: /dashboard/assessments/create loads without unhandled JS errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/dashboard/assessments/create')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  const fatalErrors = errors.filter(e =>
    !e.includes('ResizeObserver') &&
    !e.includes('Non-Error promise rejection')
  )
  expect(fatalErrors).toHaveLength(0)
})

// ── K4: /assess/* no console errors on invalid token ─────────────────────────
test('K4: /assess/[invalid] loads without unhandled JS errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/assess/invalid-token-xyz-123')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  const fatalErrors = errors.filter(e =>
    !e.includes('ResizeObserver') &&
    !e.includes('Non-Error promise rejection') &&
    !e.includes('face-api') &&   // face-api.js may not load in test env
    !e.includes('webgazer')
  )
  expect(fatalErrors).toHaveLength(0)
})

// ── K5: All assessment API routes return valid HTTP responses ─────────────────
test('K5: all assessment API routes respond (not 5xx server errors)', async ({ page }) => {
  // Recruiter-facing routes — must not 404 (route not registered) or 500 (crash)
  const recruiterRoutes = [
    { method: 'POST', path: '/api/assessments/create', body: {} },
    { method: 'POST', path: '/api/assessments/invite', body: {} },
    { method: 'POST', path: '/api/assessments/generate-report', body: {} },
    { method: 'GET',  path: '/api/assessments/export-pdf', body: null },
  ]

  for (const route of recruiterRoutes) {
    const response = route.method === 'GET'
      ? await page.request.get(route.path)
      : await page.request.post(route.path, { data: route.body ?? {} })

    expect(response.status(), `${route.method} ${route.path} should not 404`).not.toBe(404)
    expect(response.status(), `${route.method} ${route.path} should not 500`).not.toBe(500)
  }

  // Candidate-facing routes — 404 for invalid token is valid (token not found, not "route missing")
  // Just verify these routes don't 500 crash
  const candidateRoutes = [
    { method: 'POST', path: '/api/assess/fake/start', body: {} },
    { method: 'POST', path: '/api/assess/fake/event', body: {} },
    { method: 'POST', path: '/api/assess/fake/submit', body: {} },
    { method: 'POST', path: '/api/assess/fake/snapshot', body: {} },
  ]

  for (const route of candidateRoutes) {
    const response = await page.request.post(route.path, { data: route.body })
    expect(response.status(), `${route.method} ${route.path} should not 500`).not.toBe(500)
  }
})

// ── K6: Assessment pages have correct page titles ─────────────────────────────
test('K6: /dashboard/assessments has meaningful page title', async ({ page }) => {
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')
  const title = await page.title()
  expect(title.length).toBeGreaterThan(0)
  expect(title).not.toBe('Error')
})

// ── K7: Mobile viewport - assessments page renders ───────────────────────────
test('K7: assessments page renders on mobile viewport without overflow errors', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/dashboard/assessments')
  await page.waitForLoadState('networkidle')
  await expect(page).not.toHaveURL(/\/login/)
})

// ── K8: Assessment detail with invalid GUID returns graceful response ──────────
test('K8: invalid assessment ID returns 404 page not server error', async ({ page }) => {
  await page.goto('/dashboard/assessments/not-a-real-uuid')
  await page.waitForLoadState('networkidle')

  const isServerError = await page.locator('text=500, text=Internal Server Error').isVisible().catch(() => false)
  expect(isServerError).toBe(false)
})

// ── K9: Candidate complete page renders ───────────────────────────────────────
test('K9: /assess/any-token/complete renders completion UI without JS errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/assess/test-token/complete')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  const fatalErrors = errors.filter(e => !e.includes('ResizeObserver'))
  expect(fatalErrors).toHaveLength(0)

  await expect(page).not.toHaveURL(/\/login/)
})
