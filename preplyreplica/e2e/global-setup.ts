import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { loadEnvLocal } from './env'

export const FIXTURES_PATH = path.join(__dirname, '.fixtures.json')
export const TEST_PASSWORD = 'E2eTestPassword123!'

// Creates ephemeral test users (student/teacher/admin) plus one seeded,
// approved teacher_profiles row directly against the real Supabase project
// this app is configured against — there's no separate test database. Roles
// are set explicitly via the service-role key rather than relying on the
// signup DB trigger, so fixture state is deterministic regardless of that
// trigger's own health. Torn down in global-teardown.ts.
export default async function globalSetup() {
  loadEnvLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local to run e2e tests.')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const runId = Date.now()
  const fixtures: Record<string, { email: string; id: string }> = {} as any
  const roles: Array<'student' | 'teacher' | 'admin'> = ['student', 'teacher', 'admin']

  for (const role of roles) {
    const email = `e2e-${role}-${runId}@example.com`
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { role },
    })
    if (error || !data.user) {
      throw new Error(`Failed to create e2e fixture user (${role}): ${error?.message}`)
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: data.user.id, email, role, full_name: `E2E ${role}` })
    if (profileError) {
      throw new Error(`Failed to set profile role for e2e fixture (${role}): ${profileError.message}`)
    }

    fixtures[role] = { email, id: data.user.id }
  }

  const { error: teacherProfileError } = await supabase.from('teacher_profiles').upsert({
    id: fixtures.teacher.id,
    user_id: fixtures.teacher.id,
    headline: 'E2E seeded teacher profile',
    bio: 'This profile is created by the automated end-to-end test suite and torn down after the run.',
    subjects: ['Math'],
    languages: ['English'],
    hourly_rate: 20,
    status: 'approved',
  })
  if (teacherProfileError) {
    throw new Error(`Failed to seed e2e teacher_profiles row: ${teacherProfileError.message}`)
  }

  fs.writeFileSync(
    FIXTURES_PATH,
    JSON.stringify({ password: TEST_PASSWORD, ...fixtures }, null, 2)
  )
}
