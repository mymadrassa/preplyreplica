import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { calculatePricing, toPence } from '@/lib/pricing'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { teacherId, subjectId, durationHours, scheduledAt, recurrence } = body

  const { data: teacher, error: teacherError } = await supabase
    .from('teacher_profiles')
    .select('id, hourly_rate, stripe_account_id, stripe_charges_enabled, user:users(full_name)')
    .eq('id', teacherId)
    .single()

  if (teacherError || !teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
  }

  if (!teacher.stripe_account_id || !teacher.stripe_charges_enabled) {
    return NextResponse.json(
      { error: 'This teacher cannot receive payments yet' },
      { status: 400 }
    )
  }

  const pricing = calculatePricing(teacher.hourly_rate, durationHours)

  const totalStudentPaysInPence = toPence(pricing.totalStudentPays)
  const applicationFeeInPence = toPence(
    pricing.totalStudentPays - pricing.teacherReceives
  )

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      student_id: user.id,
      teacher_id: teacherId,
      subject_id: subjectId,
      duration_hours: durationHours,
      scheduled_at: scheduledAt,
      recurrence: recurrence || 'none',
      status: 'pending_payment',
      base_amount: pricing.baseAmount,
      platform_commission: pricing.platformCommission,
      total_student_pays: pricing.totalStudentPays,
      teacher_receives: pricing.teacherReceives,
    })
    .select()
    .single()

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `Lesson with ${teacher.user.full_name}`,
            description: `${durationHours}h lesson`,
          },
          unit_amount: totalStudentPaysInPence,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: applicationFeeInPence,
      transfer_data: {
        destination: teacher.stripe_account_id,
      },
      metadata: {
        bookingId: booking.id,
      },
    },
    metadata: {
      bookingId: booking.id,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/student/bookings/${booking.id}?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/student/bookings/${booking.id}?canceled=true`,
  })

  await supabase
    .from('bookings')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', booking.id)

  return NextResponse.json({ checkoutUrl: session.url })
}
