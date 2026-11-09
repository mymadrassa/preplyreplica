import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { getPaymentProvider } from '@/lib/payments'
import { LESSON_MINUTES, TRIAL, toPence, trialPrice } from '@/lib/pricing'
import { dateKey, isRangeFree } from '@/lib/availability'
import { MIN_BOOKING_NOTICE_HOURS } from '@/lib/constants'
import { emailTeacherNewRequest, loadBookableTeacher } from '@/lib/bookable'
import { PACKAGE_REQUIRED_MESSAGE } from '@/lib/trialRule'
import { loadParticipants } from '@/lib/participantNames'

// Strict: unknown fields are rejected rather than ignored.
const bookingSchema = z
  .object({
    teacherId: z.string().uuid(),
    subject: z.string().min(3),
    language: z.string().min(2),
    startAt: z.string().datetime(),
    /** A lesson from this package (no payment). Without it, the request is for the trial. */
    packageId: z.string().uuid().optional(),
  })
  .strict()

/**
 * Books one of the only two kinds of lesson there are: the 20-minute trial
 * (the first lesson with a teacher, paid at checkout), or a one-hour lesson
 * from the student's package with this teacher (no payment). There is no
 * single paid one-hour lesson.
 */
export async function POST(request: Request) {
  const supabase = createServerClient()
  // Bookings and payments are written only by the server (see migration 0036), after the checks below.
  const db = createSupabaseServiceRoleClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parseResult = bookingSchema.safeParse(await request.json())
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }
  const { teacherId, subject, language, startAt, packageId } = parseResult.data
  const isTrial = !packageId

  const bookable = await loadBookableTeacher(supabase, userId, teacherId)
  if ('error' in bookable) return NextResponse.json({ error: bookable.error }, { status: bookable.status })
  const { teacher } = bookable

  if (isTrial) {
    // The trial is only for first contact with this teacher — re-validated
    // here rather than trusting the client. Any non-cancelled/rejected
    // booking with this teacher (including an unpaid checkout in progress)
    // means the next lessons come from a package; the partial unique index
    // on bookings also guards the race between two concurrent trial requests.
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('student_id', userId)
      .eq('teacher_id', teacherId)
      .not('status', 'in', '(cancelled,rejected)')
      .limit(1)
      .maybeSingle()
    if (existingBooking) {
      return NextResponse.json({ error: PACKAGE_REQUIRED_MESSAGE }, { status: 409 })
    }
  }

  const duration = isTrial ? TRIAL.minutes : LESSON_MINUTES
  const startDate = new Date(startAt)
  const endDate = new Date(startDate.getTime() + duration * 60000)

  // Authoritative minimum-notice check — the calendar UI already disables
  // slots inside this window, but that alone is only a client-side hint;
  // this is what actually prevents a too-soon booking (e.g. a stale page,
  // or a direct API call).
  const hoursUntilStart = (startDate.getTime() - Date.now()) / (60 * 60 * 1000)
  if (hoursUntilStart < MIN_BOOKING_NOTICE_HOURS) {
    return NextResponse.json(
      { error: `Sessions must be booked at least ${MIN_BOOKING_NOTICE_HOURS} hours in advance.` },
      { status: 409 }
    )
  }

  // Re-validate against the teacher's real availability server-side —
  // the picker UI only shows open slots, but never trust that alone: the
  // slot could have been taken by someone else, or blocked, between the
  // student loading the page and submitting this request.
  // The lesson's local date, matching how availability dates are stored (not the UTC date).
  const dayKey = dateKey(startDate)
  const [{ data: daySlots }, { data: dayExceptions }, { data: dayBookings }] = await Promise.all([
    supabase.from('availability_slots').select('weekday, start_time, end_time').eq('teacher_id', teacherId),
    supabase
      .from('availability_exceptions')
      .select('exception_date, start_time, end_time, kind')
      .eq('teacher_id', teacherId)
      .eq('exception_date', dayKey),
    // All of the teacher's bookings, not just this student's (RLS would hide the others).
    createSupabaseServiceRoleClient()
      .from('bookings')
      .select('start_at, end_at, status')
      .eq('teacher_id', teacherId)
      .gte('start_at', `${dayKey}T00:00:00`)
      .lte('start_at', `${dayKey}T23:59:59`),
  ])

  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
  const slotIsFree = isRangeFree(startDate, startMinutes, startMinutes + duration, daySlots || [], dayExceptions || [], dayBookings || [])
  if (!slotIsFree) {
    return NextResponse.json({ error: 'That time is no longer available. Please pick another slot.' }, { status: 409 })
  }

  const lesson = { student_id: userId, teacher_id: teacherId, subject, language, duration, start_at: startDate.toISOString(), end_at: endDate.toISOString() }

  if (packageId) return bookWithPackage(userId, teacherId, packageId, lesson)

  // From here on: the trial, the only lesson paid on its own. The student pays
  // My Madrassa; the teacher is paid exactly the trial fee 48 hours after the
  // lesson, and My Madrassa keeps the booking fee less the real card fee
  // (recorded at capture). platform_fee is the estimate until then.
  const provider = getPaymentProvider(teacher.payment_provider)
  const pricing = trialPrice(provider.fees)
  const amount = toPence(pricing.studentPays)
  const platformFee = Math.max(0, toPence(pricing.platformNet))
  const teacherName = (await loadParticipants([teacherId])).get(teacherId)?.name ?? 'your teacher'

  const { data: booking, error: bookingError } = await db
    .from('bookings')
    .insert({
      ...lesson,
      // Holds the slot the instant checkout starts — this status (plus
      // 'pending' and 'confirmed') is what future availability checks treat
      // as occupied, so a second student can't book the same slot while this
      // one is mid-checkout. Moves to 'pending' once payment is authorized
      // (see the webhook), then 'confirmed' once the teacher approves.
      status: 'pending_payment',
      is_trial: true,
    })
    .select()
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: bookingError?.message || 'Booking creation failed' }, { status: 500 })
  }

  const { url, checkoutId, paymentId } = await provider.createCheckout({
    amount,
    currency: 'gbp',
    capture: 'manual',
    description: `${TRIAL.minutes}-minute trial lesson with ${teacherName}`,
    reference: booking.id,
    metadata: { teacher_id: teacherId, kind: 'trial' },
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/student/dashboard?booked=${booking.id}`,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/teachers/${teacherId}`,
  })

  const { error: paymentError } = await db.from('payments').insert({
    booking_id: booking.id,
    provider: provider.id,
    provider_checkout_id: checkoutId,
    provider_payment_id: paymentId,
    amount,
    currency: 'gbp',
    platform_fee: platformFee,
    teacher_fee: toPence(pricing.teacherReceives),
    processing_fee_estimate: pricing.processingFee,
    pending_fees_billed: 0,
    charge_model: 'platform',
    status: 'pending',
  })

  if (paymentError) {
    // Without this row, the payment webhook has nothing to match the
    // checkout back to — the booking would silently sit at
    // 'pending_payment' forever even if the student successfully pays. Roll
    // back the slot hold and fail loudly instead of sending them to a
    // checkout that can never be reconciled.
    await db.from('bookings').update({ status: 'cancelled' } as any).eq('id', booking.id)
    return NextResponse.json({ error: paymentError.message || 'Unable to create payment record for this booking' }, { status: 500 })
  }

  return NextResponse.json({ checkoutUrl: url })
}

/**
 * A lesson paid with a package credit: no checkout, it goes straight to the
 * teacher for approval. The credit is taken atomically first and given back
 * if the booking can't be created (or later, if it's declined or cancelled).
 */
async function bookWithPackage(
  studentId: string,
  teacherId: string,
  packageId: string,
  lesson: { student_id: string; teacher_id: string; subject: string; language: string; duration: number; start_at: string; end_at: string }
) {
  const service = createSupabaseServiceRoleClient()
  const { data: pkg } = await service.from('lesson_packages').select('student_id, teacher_id, expires_at').eq('id', packageId).maybeSingle()
  if (!pkg || pkg.student_id !== studentId || pkg.teacher_id !== teacherId) {
    return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
  }
  // A lesson must happen while the package is still valid.
  if (pkg.expires_at && new Date(lesson.end_at) > new Date(pkg.expires_at)) {
    return NextResponse.json({ error: 'Your package expires before this lesson. Pick an earlier time.' }, { status: 409 })
  }

  const { data: taken } = await service.rpc('use_package_lesson', { package: packageId, delta: 1 })
  if (!taken) {
    return NextResponse.json({ error: 'No lessons left in this package.' }, { status: 409 })
  }

  const { data: booking, error } = await service
    .from('bookings')
    .insert({ ...lesson, status: 'pending', is_trial: false, package_id: packageId })
    .select('id')
    .single()
  if (error || !booking) {
    await service.rpc('use_package_lesson', { package: packageId, delta: -1 })
    return NextResponse.json({ error: error?.message || 'Booking creation failed' }, { status: 500 })
  }

  await emailTeacherNewRequest(booking.id)
  return NextResponse.json({ bookingId: booking.id, paidWithPackage: true })
}
