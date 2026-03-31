/**
 * global.setup.ts
 * Authenticates once and saves browser storage state for all downstream tests.
 * Requires TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.test
 */
import { test as setup, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email    = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  // If no credentials provided, write empty state so downstream tests still run
  // (they will fail at auth checks and be clearly reported)
  if (!email || !password) {
    console.warn('\n⚠️  TEST_USER_EMAIL / TEST_USER_PASSWORD not set in .env.test')
    console.warn('   Authenticated tests will redirect to /login and fail.')
    console.warn('   Create .env.test with real Supabase test credentials.\n')
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }))
    return
  }

  await page.goto('/login')
  await expect(page.locator('#email')).toBeVisible()

  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })

  // Save auth state
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  await page.context().storageState({ path: AUTH_FILE })
  console.log(`✅ Authenticated as ${email}`)
})
