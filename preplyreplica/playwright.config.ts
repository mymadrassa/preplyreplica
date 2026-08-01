import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests share a live Supabase project — avoid cross-test race conditions
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Assumes `npm run dev` is already running on :3000 (this project's normal
  // dev workflow). Set REUSE_EXISTING_SERVER=false to have Playwright manage
  // its own server instead.
  webServer:
    process.env.REUSE_EXISTING_SERVER === 'false'
      ? {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: false,
          timeout: 120_000,
        }
      : {
          command: 'echo "using existing dev server on :3000"',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
        },
})
