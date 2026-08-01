import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { loadEnvLocal } from './env'
import { FIXTURES_PATH } from './global-setup'

export default async function globalTeardown() {
  loadEnvLocal()
  if (!fs.existsSync(FIXTURES_PATH)) return

  const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8'))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Deleting the auth user cascades to profiles (and teacher_profiles, via
  // the FK fixed in migration 0007) so no separate cleanup is needed there.
  for (const role of ['student', 'teacher', 'admin']) {
    const id = fixtures[role]?.id
    if (id) {
      await supabase.auth.admin.deleteUser(id).catch(() => {})
    }
  }

  fs.unlinkSync(FIXTURES_PATH)
}
