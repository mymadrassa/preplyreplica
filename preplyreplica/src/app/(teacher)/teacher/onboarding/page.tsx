import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

// Editing now lives on the Profile page. A teacher without a profile yet goes
// through the first-time guided onboarding, which creates it.
export default async function TeacherOnboardingPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) redirect('/auth/login')

  const { data: profile } = await supabase.from('teacher_profiles').select('id').eq('id', userId).maybeSingle()
  redirect(profile ? '/teacher/profile/details' : '/teacher/onboarding/subjects')
}
