import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures'

// Deliberately does not submit the form: a real submission calls Stripe's
// API to create a Connect account, which is unnecessary network dependency
// and side-effect for a fast, repeatable test run. Rendering/pre-fill and
// access control are covered instead.
test.describe('Teacher onboarding page', () => {
  test('is only reachable by teacher accounts', async ({ page }) => {
    // First-time compilation of this route in dev mode can be slow enough
    // to blow past the default 30s test timeout on its own — the 403 itself
    // renders correctly (confirmed via the page snapshot on failure), it
    // just doesn't arrive fast enough on a cold route.
    test.setTimeout(60_000)
    await loginAs(page, 'student')
    const response = await page.goto('/teacher/onboarding')
    expect(response?.status()).toBe(403)
  })

  test('pre-fills the form with the teacher\'s existing profile data', async ({ page }) => {
    await loginAs(page, 'teacher')
    await page.goto('/teacher/onboarding')
    await expect(page.getByLabel('Headline')).toHaveValue('E2E seeded teacher profile')
    await expect(page.getByRole('textbox', { name: 'Bio', exact: true })).toHaveValue(/created by the automated end-to-end test suite/)
    // Languages/subjects are checkbox chips, not a single value-bearing
    // input. "English" is also a subject option — .first() targets the
    // Languages section, which renders first in the DOM.
    await expect(page.getByLabel('English').first()).toBeChecked()
    await expect(page.getByLabel('Math')).toBeChecked()
    await expect(page.getByLabel('Hourly rate')).toHaveValue('20')
  })

  test('shows the teacher\'s current review status', async ({ page }) => {
    await loginAs(page, 'teacher')
    await page.goto('/teacher/onboarding')
    await expect(page.getByText('approved', { exact: false })).toBeVisible()
  })
})
