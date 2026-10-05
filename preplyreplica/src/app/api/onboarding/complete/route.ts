import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { completeSignup } from '@/lib/auth/completeSignup'

const weeklySlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
})

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  courses: z.array(z.string()).min(1),
  immediateAvailability: z.enum(['now', 'this_week', 'flexible']),
  weeklySlots: z.array(weeklySlotSchema),
  rhythm: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  packageSize: z.union([z.literal(4), z.literal(8), z.literal(12)]),
  selectedTeacherId: z.string().uuid().nullable(),
})

// Runs once, at the end of the guest-mode student onboarding wizard: creates
// the account, saves the collected preferences, and -- if a teacher was
// picked -- points the student at that teacher's page with a trial booking
// ready to go. It deliberately does NOT create a real booking here: the
// wizard never asked for a concrete date/time, only a preference.
export async function POST(request: Request) {
  const body = await request.json()
  const parseResult = bodySchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }
  const { email, password, courses, immediateAvailability, weeklySlots, rhythm, packageSize, selectedTeacherId } = parseResult.data

  const supabase = createServerClient()
  // This project requires email confirmation, so signUp() returns no session
  // yet -- auth.uid() is null until the student clicks the confirmation
  // link. The bookkeeping writes below must still succeed immediately, so
  // they go through the service-role client rather than the RLS-bound
  // session client.
  const serviceClient = createSupabaseServiceRoleClient()
  const signupResult = await completeSignup(
    supabase,
    {
      email,
      password,
      role: 'student',
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
    serviceClient
  )

  if (!signupResult.ok) {
    return NextResponse.json({ error: signupResult.message }, { status: signupResult.status })
  }

  const { error: preferencesError } = await serviceClient.from('student_preferences').upsert({
    id: signupResult.userId,
    courses,
    immediate_availability: immediateAvailability,
    weekly_slots: weeklySlots,
    lessons_per_week: rhythm,
    monthly_package_size: packageSize,
    selected_teacher_id: selectedTeacherId,
  })
  if (preferencesError) {
    return NextResponse.json({ error: `Could not save preferences: ${preferencesError.message}` }, { status: 500 })
  }

  if (selectedTeacherId) {
    await serviceClient.from('recommendation_events').insert({
      teacher_id: selectedTeacherId,
      event_type: 'selection',
      student_id: signupResult.hasSession ? signupResult.userId : null,
    })
  }

  if (!signupResult.hasSession) {
    // Email confirmation required -- no session to redirect into yet.
    return NextResponse.json({ redirectTo: null, needsEmailConfirmation: true })
  }

  const redirectTo = selectedTeacherId ? `/teachers/${selectedTeacherId}?intent=trial` : '/student/dashboard'
  return NextResponse.json({ redirectTo, needsEmailConfirmation: false })
}
