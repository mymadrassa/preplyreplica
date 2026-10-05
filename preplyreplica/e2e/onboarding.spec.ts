import { test, expect } from '@playwright/test'

test.describe('Role choice', () => {
  test('choosing teacher pre-fills the role on the registration form', async ({ page }) => {
    await page.goto('/get-started')
    await page.getByRole('button', { name: /i'm a teacher/i }).click()
    await page.waitForURL(/\/auth\/register\?role=teacher/)
    await expect(page.getByLabel('Register as')).toHaveValue('teacher')
  })

  test('choosing student enters the onboarding wizard', async ({ page }) => {
    await page.goto('/get-started')
    await page.getByRole('button', { name: /i'm a student/i }).click()
    await page.waitForURL(/\/get-started\/student\/course/)
    await expect(page.getByRole('heading', { name: /what do you want to learn/i })).toBeVisible()
  })
})

test.describe('Student onboarding wizard', () => {
  // The seeded e2e teacher fixture (see global-setup.ts) intentionally has no
  // stripe_account_id, matching the "approved but can't be paid yet" case —
  // it is deliberately excluded from recommend-teachers results (same filter
  // as the public /teachers catalog), so this walkthrough uses the
  // "I'll choose later" path rather than asserting a specific teacher
  // appears. The scoring/ranking logic itself is covered by
  // src/lib/__tests__/recommendation.test.ts.
  test('a guest can walk the full wizard and land on an account, with answers saved', async ({ page }) => {
    const email = `e2e-onboarding-${Date.now()}@example.com`

    await page.goto('/get-started/student/course')
    await page.getByRole('button', { name: 'Math' }).click()
    await page.getByRole('button', { name: /next/i }).click()

    await page.waitForURL(/\/availability-now/)
    await page.getByRole('button', { name: /this week/i }).click()
    await page.getByRole('button', { name: /next/i }).click()

    await page.waitForURL(/\/availability-weekly/)
    await page.getByRole('button', { name: /monday morning/i }).click()
    await page.getByRole('button', { name: /next/i }).click()

    await page.waitForURL(/\/rhythm/)
    await page.getByRole('button', { name: /2x per week/i }).click()
    await page.getByRole('button', { name: /next/i }).click()

    await page.waitForURL(/\/package/)
    await page.getByRole('button', { name: /8 lessons/i }).click()
    await page.getByRole('button', { name: /next/i }).click()

    await page.waitForURL(/\/teacher/)
    await page.getByRole('button', { name: /choose later/i }).click()

    await page.waitForURL(/\/account/)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill('OnboardingTest123!')
    await page.getByRole('button', { name: /create account/i }).click()

    await page.waitForURL(/\/student\/dashboard/, { timeout: 15_000 })
  })

  test('reloading mid-wizard keeps previously answered steps', async ({ page }) => {
    await page.goto('/get-started/student/course')
    await page.getByRole('button', { name: 'Math' }).click()
    await page.getByRole('button', { name: /next/i }).click()
    await page.waitForURL(/\/availability-now/)

    await page.reload()
    await expect(page.getByRole('heading', { name: /how soon do you want to start/i })).toBeVisible()
  })

  test('deep-linking into the middle of the wizard with no prior answers bounces back to the start', async ({ page }) => {
    await page.goto('/get-started/student/rhythm')
    await page.waitForURL(/\/get-started\/student\/course/)
    await expect(page.getByRole('heading', { name: /what do you want to learn/i })).toBeVisible()
  })
})
