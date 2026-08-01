import fs from 'fs'
import type { Page } from '@playwright/test'
import { FIXTURES_PATH } from './global-setup'

export interface Fixtures {
  password: string
  student: { email: string; id: string }
  teacher: { email: string; id: string }
  admin: { email: string; id: string }
}

export function getFixtures(): Fixtures {
  return JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8'))
}

/** Logs in through the real UI form (not a cookie shortcut) so auth wiring itself stays covered. */
export async function loginAs(page: Page, role: 'student' | 'teacher' | 'admin') {
  const fixtures = getFixtures()
  const { email } = fixtures[role]
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(fixtures.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(new RegExp(`/${role}/dashboard`), { timeout: 15_000 })
}
