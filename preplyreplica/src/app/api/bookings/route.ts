import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { createBookingCheckoutSession } from '@/lib/stripe'
import { calculatePricing, toPence } from '@/lib/pricing'
import { isRangeFree } from '@/lib/availability'
import { MIN_BOOKING_NOTICE_HOURS } from '@/lib/constants'

const bookingSchema = z.object({
  teacherId: z.string().uuid(),
  subject: z.string().min(3),
  language: z.string().min(2),
  duration: z.number().int().refine((value) => [30, 45, 60, 90].includes(value)),
  startAt: z.string().datetime(),
})

export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parseResult = bookingSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }

  const { teacherId, subject, language, duration, startAt } = parseResult.data

  const { data: teacher } = await supabase.from('teacher_profiles').select('*').eq('id', teacherId).single()
  if (!teacher || teacher.status !== 'approved' || !teacher.stripe_account_id) {
    return NextResponse.json({ error: 'Teacher is not available for booking' }, { status: 400 })
  }

  const { data: studentProfile } = await supabase.from('profiles').select('pending_stripe_fees').eq('id', userId).single()
  const pendingFeesOwed = Number((studentProfile as { pending_stripe_fees: number } | null)?.pending_stripe_fees ?? 0)

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
  const dayKey = startDate.toISOString().slice(0, 10)
  const [{ data: daySlots }, { data: dayExceptions }, { data: dayBookings }] = await Promise.all([
    supabase.from('availability_slots').select('weekday, start_time, end_time').eq('teacher_id', teacherId),
    supabase
      .from('availability_exceptions')
      .select('exception_date, start_time, end_time, exception_type')
      .eq('teacher_id', teacherId)
      .eq('exception_date', dayKey),
    supabase
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

  // Teacher always nets their full base rate. The commission funds the
  // platform's cut; Stripe's real processing fee (deducted automatically
  // from the teacher's connected-account balance under direct charges) is
  // covered by reducing the application fee accordingly, and recouped from
  // the student later rather than split per-transaction — see lib/pricing.ts.
  const pricing = calculatePricing(teacher.hourly_rate, duration / 60)
  const amount = Math.max(500, toPence(pricing.totalStudentPays) + toPence(pendingFeesOwed))
  const teacherFee = toPence(pricing.teacherReceives)
  const commissionAfterFee = Math.max(0, toPence(pricing.platformCommission) - toPence(pricing.estimatedStripeFee))
  const applicationFeeAmount = commissionAfterFee + toPence(pendingFeesOwed)
  const platformFee = applicationFeeAmount

  const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
    student_id: userId,
    teacher_id: teacherId,
    subject,
    language,
    duration,
    start_at: startDate.toISOString(),
    end_at: endDate.toISOString(),
    // Holds the slot the instant checkout starts — this status (plus
    // 'pending' and 'confirmed') is what future availability checks treat
    // as occupied, so a second student can't book the same slot while this
    // one is mid-checkout. Moves to 'pending' once payment is authorized
    // (see the webhook), then 'confirmed' once the teacher approves.
    status: 'pending_payment',
  }).select().single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: bookingError?.message || 'Booking creation failed' }, { status: 500 })
  }

  const { url, sessionId, paymentIntent } = await createBookingCheckoutSession({
    amount,
    applicationFeeAmount,
    teacherAccountId: teacher.stripe_account_id,
    bookingId: booking.id,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/student/bookings`,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/teachers/${teacherId}`,
  })

  await supabase.from('payments').insert({
    booking_id: booking.id,
    stripe_checkout_session_id: sessionId,
    stripe_payment_intent_id: paymentIntent,
    amount,
    currency: 'gbp',
    platform_fee: platformFee,
    teacher_fee: teacherFee,
    stripe_fee_estimate: pricing.estimatedStripeFee,
    pending_fees_billed: pendingFeesOwed,
    status: 'pending',
  })

  return NextResponse.json({ checkoutUrl: url })
}
