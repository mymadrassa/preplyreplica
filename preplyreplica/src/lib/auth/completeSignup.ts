import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface CompleteSignupParams {
  email: string
  password: string
  role: 'student' | 'teacher'
  emailRedirectTo: string
}

export type CompleteSignupResult =
  | { ok: true; userId: string; hasSession: boolean }
  | { ok: false; status: number; message: string }

// Shared by the direct registration page (browser client) and the
// onboarding-wizard completion route (server client) so the anti-enumeration
// handling and profiles upsert can't drift between the two entry points.
//
// `profilesClient` writes the profiles row and defaults to `supabase` itself.
// Pass a service-role client instead when this project requires email
// confirmation (no session exists yet right after signUp, so profiles' RLS
// policy -- which checks auth.uid() = id -- would otherwise reject the write).
export async function completeSignup(
  supabase: SupabaseClient<Database>,
  { email, password, role, emailRedirectTo }: CompleteSignupParams,
  profilesClient: SupabaseClient<Database> = supabase
): Promise<CompleteSignupResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo, data: { role } },
  })

  if (error) {
    return { ok: false, status: 400, message: error.message }
  }

  // Supabase deliberately returns no error when the email already belongs to
  // a confirmed account (anti-enumeration) -- it returns a user object with
  // an empty `identities` array instead. Without this check the flow falls
  // through as if a brand-new signup succeeded.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { ok: false, status: 409, message: 'An account with this email already exists. Please log in instead.' }
  }

  if (!data.user) {
    return { ok: false, status: 500, message: 'Signup did not return a user.' }
  }

  const profile: Database['public']['Tables']['profiles']['Insert'] = {
    id: data.user.id,
    email,
    role,
  }
  const { error: profileError } = await profilesClient.from('profiles').upsert(profile)
  if (profileError) {
    return { ok: false, status: 500, message: `Profile error: ${profileError.message}` }
  }

  return { ok: true, userId: data.user.id, hasSession: Boolean(data.session) }
}
