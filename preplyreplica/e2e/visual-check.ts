import { chromium } from '@playwright/test'
import globalSetup, { TEST_PASSWORD, FIXTURES_PATH } from './global-setup'
import globalTeardown from './global-teardown'
import fs from 'fs'

const SCRATCH = 'C:\\Users\\PC\\AppData\\Local\\Temp\\claude\\c--Users-PC-Desktop-preplyreplica\\5afbc3d6-d255-4c6f-9631-19e38b84972b\\scratchpad'

async function main() {
  await globalSetup()
  const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8'))

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/auth/login')
  await page.getByLabel('Email').fill(fixtures.teacher.email)
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/teacher\/dashboard/, { timeout: 15000 })

  // Seed a couple of slots so the calendar has something to show.
  await page.goto('http://localhost:3000/teacher/availability')
  const addSlotForm = page.locator('form', { has: page.getByRole('button', { name: /save slot/i }) })
  await addSlotForm.getByLabel('Weekday').selectOption('1')
  await addSlotForm.getByLabel('Start time').selectOption('09:00')
  await addSlotForm.getByLabel('End time').selectOption('12:00')
  await addSlotForm.getByRole('button', { name: /save slot/i }).click()
  await page.waitForTimeout(1000)

  await addSlotForm.getByLabel('Weekday').selectOption('3')
  await addSlotForm.getByLabel('Start time').selectOption('14:00')
  await addSlotForm.getByLabel('End time').selectOption('17:00')
  await addSlotForm.getByRole('button', { name: /save slot/i }).click()
  await page.waitForTimeout(1000)

  await page.screenshot({ path: `${SCRATCH}\\cal-week.png`, fullPage: true })

  // Hover over an available cell to trigger the tooltip / cursor state.
  const availableCell = page.locator('[title="Available for booking"]').first()
  await availableCell.hover()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SCRATCH}\\cal-hover.png`, fullPage: true })

  // Switch to month view.
  await page.getByRole('button', { name: /^month$/i }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SCRATCH}\\cal-month.png`, fullPage: true })

  // Navigate to next month.
  await page.getByLabel('Next').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SCRATCH}\\cal-month-next.png`, fullPage: true })

  // Search the weekly schedule list.
  await page.getByPlaceholder(/search by day or time/i).fill('Wednesday')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SCRATCH}\\cal-search.png`, fullPage: true })

  await browser.close()
  await globalTeardown()
}

main().catch(async (err) => {
  console.error(err)
  try { await globalTeardown() } catch {}
  process.exit(1)
})
