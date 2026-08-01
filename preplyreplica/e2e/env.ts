import fs from 'fs'
import path from 'path'

// Playwright's config/global-setup run as plain Node scripts, outside
// Next.js's own env loading — read .env.local manually so tests can reach
// the same Supabase project the app uses locally.
export function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key && !(key in process.env)) {
      process.env[key] = value
    }
  }
}
