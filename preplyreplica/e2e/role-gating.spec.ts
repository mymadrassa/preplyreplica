import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures'

test.describe('Middleware role gating', () => {
  test('an unauthenticated visitor is redirected to login from every protected area', async ({ page }) => {
    for (const path of ['/student/dashboard', '/teacher/dashboard', '/admin/dashboard']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/auth\/login/);
    }
  })

  test('a student cannot access the teacher dashboard', async ({ page }) => {
    await loginAs(page, 'student')
    const response = await page.goto('/teacher/dashboard')
    expect(response?.status()).toBe(403)
  })

  test('a student cannot access the admin dashboard', async ({ page }) => {
    await loginAs(page, 'student')
    const response = await page.goto('/admin/dashboard')
    expect(response?.status()).toBe(403)
  })

  test('a teacher cannot access the admin dashboard', async ({ page }) => {
    await loginAs(page, 'teacher')
    const response = await page.goto('/admin/dashboard')
    expect(response?.status()).toBe(403)
  })

  test('a teacher cannot access the student dashboard', async ({ page }) => {
    await loginAs(page, 'teacher')
    const response = await page.goto('/student/dashboard')
    expect(response?.status()).toBe(403)
  })

  test('an admin can reach the admin dashboard', async ({ page }) => {
    await loginAs(page, 'admin')
    const response = await page.goto('/admin/dashboard')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /review teacher requests/i })).toBeVisible()
  })
})
