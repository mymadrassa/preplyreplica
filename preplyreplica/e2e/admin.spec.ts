import { test, expect } from '@playwright/test'
import { getFixtures, loginAs } from './fixtures'

test.describe('Admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/admin/dashboard')
  })

  test('lists the seeded teacher by default', async ({ page }) => {
    await expect(page.getByText('E2E seeded teacher profile')).toBeVisible()
  })

  test('search narrows results by name/headline/subject', async ({ page }) => {
    await page.getByLabel('Search').fill('E2E seeded teacher profile')
    await page.getByRole('button', { name: /search/i }).click()
    await expect(page.getByText('E2E seeded teacher profile')).toBeVisible()

    await page.getByLabel('Search').fill('a headline that does not exist anywhere')
    await page.getByRole('button', { name: /search/i }).click()
    await expect(page.getByText(/no teachers match your filters/i)).toBeVisible()
  })

  test('status filter narrows results correctly', async ({ page }) => {
    await page.getByLabel('Status').selectOption('rejected')
    await page.getByRole('button', { name: /search/i }).click()
    await expect(page.getByText('E2E seeded teacher profile')).not.toBeVisible()

    await page.getByLabel('Status').selectOption('approved')
    await page.getByRole('button', { name: /search/i }).click()
    await expect(page.getByText('E2E seeded teacher profile')).toBeVisible()
  })

  test('expanding the seeded teacher reveals their full profile details', async ({ page }) => {
    const fixtures = getFixtures()
    // Scoped by data-testid — other, older teacher rows already exist in
    // the shared database from prior manual testing, so plain text/DOM
    // proximity locators are ambiguous here.
    const card = page.getByTestId(`admin-teacher-card-${fixtures.teacher.id}`)
    await card.getByRole('button', { name: /view full profile/i }).click()
    await expect(card.getByText(/created by the automated end-to-end test suite/i)).toBeVisible()
    await expect(card.getByText('None uploaded.')).toBeVisible()
  })

  test('changing status away from and back to approved works end-to-end', async ({ page }) => {
    const fixtures = getFixtures()
    const card = page.getByTestId(`admin-teacher-card-${fixtures.teacher.id}`)

    await card.getByRole('button', { name: /change status/i }).click()
    await card.getByRole('button', { name: /set to pending/i }).click()
    await expect(card.getByText('pending', { exact: false })).toBeVisible()

    // Restore the fixture to 'approved' so other spec files relying on it stay valid.
    // Once status is 'pending' the card renders Approve/Reject/Suspend directly
    // (no "Change status" pencil step in between) — see AdminTeacherCard.tsx.
    await card.getByRole('button', { name: /^approve$/i }).click()
    await expect(card.getByText('approved', { exact: false })).toBeVisible()
  })
})
