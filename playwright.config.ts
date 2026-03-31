import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load test-specific env vars; fall back to .env.local for Supabase public keys
dotenv.config({ path: path.resolve(__dirname, '.env.test') })
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: false })

const AUTH_FILE = 'tests/.auth/user.json'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'tests/html-report' }],
  ],

  projects: [
    // ── 1. Auth setup (runs first, once) ────────────────────────────────────
    {
      name: 'setup',
      testMatch: '**/global.setup.ts',
    },

    // ── 2. Authenticated tests (most test files) ─────────────────────────────
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
      testIgnore: ['**/global.setup.ts', '**/j-general.spec.ts'],
    },

    // ── 3. General / build tests (no auth state needed) ──────────────────────
    {
      name: 'general',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/j-general.spec.ts',
    },
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    stderr: 'pipe',
  },
})
