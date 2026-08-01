import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { createBookingCheckoutSession } from '@/lib/stripe'
import { calculatePricing, toPence } from '@/lib/pricing'

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
    status: 'pending',
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
