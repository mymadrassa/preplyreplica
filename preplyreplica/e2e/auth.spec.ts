import { test, expect } from '@playwright/test'
import { getFixtures } from './fixtures'

test.describe('Registration', () => {
  test('registering with an email that already has an account shows a clear error, not silent success', async ({ page }) => {
    const fixtures = getFixtures()
    await page.goto('/auth/register')
    await page.getByLabel('Email').fill(fixtures.student.email)
    await page.getByLabel('Password', { exact: true }).fill('SomeOtherPassword123!')
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByText(/already/i)).toBeVisible({ timeout: 10_000 })
  })

  test('the password field has a visibility toggle', async ({ page }) => {
    await page.goto('/auth/register')
    const passwordInput = page.getByLabel('Password', { exact: true })
    await expect(passwordInput).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: /show password/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'text')
  })
})

test.describe('Login', () => {
  test('wrong password shows an error and does not navigate away', async ({ page }) => {
    const fixtures = getFixtures()
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(fixtures.student.email)
    await page.getByLabel('Password', { exact: true }).fill('DefinitelyWrongPassword!')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('a student logging in with correct credentials lands on the student dashboard', async ({ page }) => {
    const fixtures = getFixtures()
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(fixtures.student.email)
    await page.getByLabel('Password', { exact: true }).fill(fixtures.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL(/\/student\/dashboard/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /your upcoming lessons/i })).toBeVisible()
  })

  test('a teacher logging in lands on the teacher dashboard, not the student one', async ({ page }) => {
    const fixtures = getFixtures()
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(fixtures.teacher.email)
    await page.getByLabel('Password', { exact: true }).fill(fixtures.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL(/\/teacher\/dashboard/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /your teaching schedule/i })).toBeVisible()
  })

  test('has a forgot password link', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
  })
})

test.describe('Forgot password', () => {
  test('submitting an email shows a non-committal confirmation (does not reveal whether the account exists)', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await page.getByLabel('Email').fill('someone@example.com')
    await page.getByRole('button', { name: /send reset link/i }).click()
    await expect(page.getByText(/if an account exists/i)).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Sign out', () => {
  test('signing out clears the session and returns to a logged-out navbar', async ({ page }) => {
    const fixtures = getFixtures()
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(fixtures.student.email)
    await page.getByLabel('Password', { exact: true }).fill(fixtures.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL(/\/student\/dashboard/, { timeout: 15_000 })

    await page.getByRole('button', { name: /account/i }).click()
    await page.getByRole('button', { name: /sign out/i }).click()
    await page.waitForURL('/', { timeout: 15_000 })
    await expect(page.getByRole('link', { name: /^login$/i })).toBeVisible()
  })
})
