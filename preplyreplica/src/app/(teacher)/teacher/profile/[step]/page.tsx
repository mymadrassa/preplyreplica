import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadTeacherProfileState } from '@/lib/teacherProfileState'
import { PROFILE_STEPS, type ProfileStep } from './steps'
import { ProfileWizard } from './ProfileWizard'

export default async function TeacherProfilePage({ params }: { params: { step: string } }) {
  const step = params.step as ProfileStep
  if (!PROFILE_STEPS.includes(step)) notFound()

  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/login')

  const state = await loadTeacherProfileState(supabase, userId)
  // No profile yet: the first-time guided onboarding creates it.
  if (!state) redirect('/teacher/onboarding/subjects')

  const { teacher } = state
  return (
    <ProfileWizard
      step={step}
      userId={userId}
      mode={state.mode}
      status={teacher.status}
      details={{
        headline: teacher.headline,
        bio: teacher.bio,
        languages: teacher.languages ?? [],
        subjects: teacher.subjects ?? [],
        hourly_rate: teacher.hourly_rate,
        video_url: teacher.video_url,
      }}
      stripeConnected={teacher.stripe_charges_enabled}
      live={state.live}
      pending={state.pending}
      changesState={state.changes?.state ?? null}
      reviewNote={state.changes?.review_note ?? null}
      documents={state.documents}
      readiness={state.readiness}
    />
  )
}
