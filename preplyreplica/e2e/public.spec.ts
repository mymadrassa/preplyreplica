import { test, expect } from '@playwright/test'
import { getFixtures } from './fixtures'

test.describe('Public pages (no auth)', () => {
  test('home page renders the hero and primary CTAs', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /find your next tutor/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /find tutors/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /create an account/i })).toBeVisible()
  })

  test('teachers listing shows the search/filter bar and the seeded approved teacher', async ({ page }) => {
    await page.goto('/teachers')
    await expect(page.getByLabel('Subject')).toBeVisible()
    await expect(page.getByLabel('Language')).toBeVisible()
    await expect(page.getByLabel('Max hourly rate')).toBeVisible()
    await expect(page.getByLabel('Sort by')).toBeVisible()
    await expect(page.getByText('E2E seeded teacher profile')).toBeVisible()
  })

  test('filtering by a subject the seeded teacher does not teach hides them', async ({ page }) => {
    await page.goto('/teachers?subject=Physics')
    await expect(page.getByText('No teachers match your filters')).toBeVisible()
  })

  test('filtering by the subject the seeded teacher does teach keeps them visible', async ({ page }) => {
    await page.goto('/teachers?subject=Math')
    await expect(page.getByText('E2E seeded teacher profile')).toBeVisible()
  })

  test('teacher detail page shows profile info and a rating/review summary', async ({ page }) => {
    const fixtures = getFixtures()
    await page.goto(`/teachers/${fixtures.teacher.id}`)
    await expect(page.getByText('E2E seeded teacher profile')).toBeVisible()
    // "Math" also appears as the pre-selected option in the booking form's
    // subject <select> further down the page — .first() targets the
    // profile's own "Subjects" paragraph, which renders first in the DOM.
    await expect(page.getByText('Math').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()
    await expect(page.getByText('No reviews yet')).toBeVisible()
  })

  test('a logged-out visitor sees the booking form on an approved teacher profile', async ({ page }) => {
    const fixtures = getFixtures()
    await page.goto(`/teachers/${fixtures.teacher.id}`)
    await expect(page.getByRole('heading', { name: /book a lesson/i })).toBeVisible()
  })
})
