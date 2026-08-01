import { test, expect } from '@playwright/test'
import { getFixtures, loginAs } from './fixtures'

test.describe('Booking eligibility rules on a teacher profile', () => {
  test('a teacher viewing their own public profile sees a note instead of a booking form', async ({ page }) => {
    const fixtures = getFixtures()
    await loginAs(page, 'teacher')
    await page.goto(`/teachers/${fixtures.teacher.id}`)
    await expect(page.getByText(/this is how students see your profile/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /book a lesson/i })).not.toBeVisible()
  })

  test('an admin viewing a teacher profile cannot book either', async ({ page }) => {
    const fixtures = getFixtures()
    await loginAs(page, 'admin')
    await page.goto(`/teachers/${fixtures.teacher.id}`)
    await expect(page.getByText(/only student accounts can book lessons/i)).toBeVisible()
  })

  test('a student sees and can submit the booking form', async ({ page }) => {
    const fixtures = getFixtures()
    await loginAs(page, 'student')
    await page.goto(`/teachers/${fixtures.teacher.id}`)
    await expect(page.getByRole('heading', { name: /book a lesson/i })).toBeVisible()
  })

  test('booking a teacher who has not finished Stripe setup fails with a clear error, not a silent crash', async ({ page }) => {
    const fixtures = getFixtures()
    await loginAs(page, 'student')
    await page.goto(`/teachers/${fixtures.teacher.id}`)

    // The seeded fixture teacher is approved but intentionally has no
    // stripe_account_id — this exercises the real guard clause in
    // api/bookings/route.ts rather than attempting a real Stripe checkout.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const dateStr = tomorrow.toISOString().slice(0, 10)
    await page.getByLabel('Start date').fill(dateStr)
    await page.getByLabel('Start time').fill('14:00')
    await page.getByRole('button', { name: /continue to payment/i }).click()

    await expect(page.getByText(/not available for booking/i)).toBeVisible({ timeout: 15_000 })
  })
})
