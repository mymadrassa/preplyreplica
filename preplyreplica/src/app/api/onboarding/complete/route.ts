import { NextResponse } from 'next/server'
import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { firstNameSchema, fullNameFrom, lastNameSchema } from '@/lib/names'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { completeSignup } from '@/lib/auth/completeSignup'
import { normalizePhone, PHONE_HINT } from '@/lib/phone'
import { canBeMatched } from '@/lib/gender'

const weeklySlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
})

const bodySchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`),
  phone: z
    .string()
    .transform((value) => normalizePhone(value))
    .refine((value): value is string => value !== null, { message: PHONE_HINT }),
  gender: z.enum(['male', 'female'], { errorMap: () => ({ message: 'Tell us whether you are male or female.' }) }),
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
    return NextResponse.json({ error: parseResult.error.issues[0]?.message ?? 'Invalid details.' }, { status: 400 })
  }
  const { firstName, lastName, email, password, phone, gender, courses, immediateAvailability, weeklySlots, rhythm, packageSize } = parseResult.data

  const supabase = createServerClient()
  // This project requires email confirmation, so signUp() returns no session
  // yet -- auth.uid() is null until the student clicks the confirmation
  // link. The bookkeeping writes below must still succeed immediately, so
  // they go through the service-role client rather than the RLS-bound
  // session client.
  const serviceClient = createSupabaseServiceRoleClient()
  // A teacher picked in the wizard is only kept if they teach this student's gender.
  const requestedTeacherId = parseResult.data.selectedTeacherId
  const { data: pickedTeacher } = requestedTeacherId
    ? await serviceClient.from('profiles').select('gender').eq('id', requestedTeacherId).maybeSingle()
    : { data: null }
  const selectedTeacherId = requestedTeacherId && canBeMatched(gender, pickedTeacher?.gender) ? requestedTeacherId : null
  const signupResult = await completeSignup(
    supabase,
    {
      email,
      password,
      role: 'student',
      phone,
      gender,
      fullName: fullNameFrom(firstName, lastName),
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?type=email`,
    },
    serviceClient
  )

  if (!signupResult.ok) {
    await serviceClient.from('error_logs').insert({ context: 'onboarding_signup', message: signupResult.message, detail: signupResult.rawMessage })
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
    await serviceClient
      .from('error_logs')
      .insert({ context: 'onboarding_preferences', message: 'Could not save preferences', detail: preferencesError.message })
    return NextResponse.json({ error: 'We created your account, but something went wrong saving your preferences. You can set them later from your dashboard.' }, { status: 500 })
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
