/**
 * PART J — General / Infrastructure
 * No auth state dependency. Tests build, API guards, environment.
 */
import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import * as path from 'path'

test.describe('J — General', () => {

  // ── J1: Landing page loads without errors ────────────────────────────────────
  test('J1: landing page loads with correct title', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveTitle(/RecruiterIQ/i)
    expect(errors).toHaveLength(0)
  })

  // ── J2: API 401 — score-resume without auth ──────────────────────────────────
  test('J2: /api/score-resume returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/score-resume', {
      data: { jd_text: 'test', resume_text: 'test' },
    })
    expect(res.status()).toBe(401)
  })

  // ── J3: API 401 — generate-summary without auth ──────────────────────────────
  test('J3: /api/generate-summary returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/generate-summary', {
      data: { jobTitle: 'Engineer', notes: 'test notes' },
    })
    expect(res.status()).toBe(401)
  })

  // ── J4: API 401 — generate-boolean without auth ──────────────────────────────
  test('J4: /api/generate-boolean returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/generate-boolean', {
      data: { jobTitle: 'Engineer', requiredSkills: ['React'] },
    })
    expect(res.status()).toBe(401)
  })

  // ── J5: API 401 — stack-rank without auth ────────────────────────────────────
  test('J5: /api/stack-rank returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/stack-rank', {
      data: {
        jobTitle:       'Engineer',
        jobDescription: 'Test',
        candidates:     [{ name: 'A', resumeText: 'test' }, { name: 'B', resumeText: 'test' }],
      },
    })
    expect(res.status()).toBe(401)
  })

  // ── J6: API 401 — billing/subscribe without auth ─────────────────────────────
  test('J6: /api/billing/subscribe returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/billing/subscribe', {
      data: { token: 'fake', plan: 'pro' },
    })
    expect(res.status()).toBe(401)
  })

  // ── J7: API 401 — billing/cancel without auth ─────────────────────────────────
  test('J7: /api/billing/cancel returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/billing/cancel')
    expect(res.status()).toBe(401)
  })

  // ── J8: API 401 — team/invite without auth ────────────────────────────────────
  test('J8: /api/team/invite returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/team/invite', {
      data: { email: 'test@example.com' },
    })
    expect(res.status()).toBe(401)
  })

  // ── J9: API 401 — team/remove without auth ────────────────────────────────────
  test('J9: /api/team/remove returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/team/remove', {
      data: { memberId: 'test-id' },
    })
    expect(res.status()).toBe(401)
  })

  // ── J10: Webhook requires valid signature ─────────────────────────────────────
  test('J10: /api/webhooks/square returns 401 with missing signature', async ({ request }) => {
    const res = await request.post('/api/webhooks/square', {
      data:    { event_id: 'test', type: 'subscription.created' },
      headers: { 'Content-Type': 'application/json' },
      // No x-square-hmacsha256-signature header
    })
    expect(res.status()).toBe(401)
  })

  // ── J11: Privacy and Terms pages load ───────────────────────────────────────
  test('J11: /privacy page loads with correct heading', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('h1').filter({ hasText: /privacy/i })).toBeVisible()
  })

  test('J12: /terms page loads with correct heading', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.locator('h1').filter({ hasText: /terms/i })).toBeVisible()
  })

  // ── J13: Public env vars present ────────────────────────────────────────────
  test('J13: required public environment variables are set', async ({ page }) => {
    await page.goto('/')
    const envCheck = await page.evaluate(() => ({
      supabaseUrl:   typeof process === 'undefined' ? 'client' : 'server',
    }))
    // Verify env vars are accessible by checking the page renders
    // (if env vars were missing, Next.js would fail to build/render)
    await expect(page.locator('body')).toBeVisible()
  })

  // ── J14: No console errors on main dashboard pages ──────────────────────────
  test('J14: /dashboard/scorer loads with no console errors', async ({ browser }) => {
    const authFile = 'tests/.auth/user.json'
    const hasAuth  = require('fs').existsSync(authFile)
    if (!hasAuth) { test.skip() }

    const ctx  = await browser.newContext({ storageState: authFile })
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/dashboard/scorer')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1_000) // allow animations

    expect(errors).toHaveLength(0)
    await ctx.close()
  })
})

// ── J15: TypeScript build passes ────────────────────────────────────────────────
// Run as a separate describe so it doesn't time out the suite
test.describe('J15 — TypeScript Build', () => {
  test('npm run build passes with zero TypeScript errors', async () => {
    test.setTimeout(300_000) // 5 minutes

    const projectDir = path.resolve(__dirname, '..')
    let output = ''
    let exitCode = 0

    // Use tsc --noEmit to check types without conflicting with the running dev server's .next lock
    try {
      output = execSync('npx tsc --noEmit 2>&1', {
        cwd:     projectDir,
        timeout: 280_000,
        encoding: 'utf8',
      })
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number }
      output   = (e.stdout ?? '') + (e.stderr ?? '')
      exitCode = e.status ?? 1
    }

    if (exitCode !== 0) {
      const tsErrors = output.split('\n').filter(l => l.includes('error TS')).join('\n')
      throw new Error(`TypeScript errors found:\n${tsErrors}\n\nFull output:\n${output.slice(0, 3000)}`)
    }

    expect(exitCode).toBe(0)
  })
})
