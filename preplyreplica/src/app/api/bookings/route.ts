// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/api/bookings/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { createBookingCheckoutSession } from '@/lib/stripe'

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

  const startDate = new Date(startAt)
  const endDate = new Date(startDate.getTime() + duration * 60000)
  const amount = Math.max(500, Math.round((teacher.hourly_rate * duration) / 60 * 100))
  const platformFee = Math.round(amount * Number(process.env.STRIPE_PLATFORM_FEE_PERCENT || '15') / 100)
  const teacherFee = amount - platformFee

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
    platform_fee: platformFee,
    teacher_fee: teacherFee,
    status: 'pending',
  })

  return NextResponse.json({ checkoutUrl: url })
}
