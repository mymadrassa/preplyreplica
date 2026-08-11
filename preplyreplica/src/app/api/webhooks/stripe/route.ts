// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/api/webhooks/stripe/route.ts
import type Stripe from 'stripe'
import type { Database } from '@/types/database'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { constructStripeEvent } from '@/lib/stripe'
import { sendNewBookingRequestEmail } from '@/lib/email'

type PaymentRow = Database['public']['Tables']['payments']['Row']

export async function POST(request: Request) {
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')
  const payload = await request.text()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing webhook signature or secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = constructStripeEvent(payload, signature, webhookSecret)
  } catch (error) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const supabase = createSupabaseServiceRoleClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ received: true })
    }

    const checkoutId = session.id
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_checkout_session_id', checkoutId)
      .single<PaymentRow>()

    if (payment) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('student_id, teacher_id, subject, start_at')
        .eq('id', payment.booking_id)
        .single()
      // Payment is authorized (manual capture), not charged yet — the
      // booking waits on the teacher's approval before any money moves.
      await supabase.from('bookings').update({ status: 'pending' } as Database['public']['Tables']['bookings']['Update']).eq('id', payment.booking_id)
      await supabase.from('payments').update({ status: 'authorized' } as Database['public']['Tables']['payments']['Update']).eq('id', payment.id)

      if (booking?.student_id) {
        const { data: profile } = await supabase.from('profiles').select('pending_stripe_fees').eq('id', booking.student_id).single()
        const currentPending = Number((profile as { pending_stripe_fees: number } | null)?.pending_stripe_fees ?? 0)
        const nextPending = currentPending - Number(payment.pending_fees_billed ?? 0) + Number(payment.stripe_fee_estimate ?? 0)
        await supabase
          .from('profiles')
          .update({ pending_stripe_fees: Math.max(0, nextPending) } as Database['public']['Tables']['profiles']['Update'])
          .eq('id', booking.student_id)
      }

      if (booking?.teacher_id) {
        const [{ data: teacherProfile }, { data: studentProfile }] = await Promise.all([
          supabase.from('teacher_profiles').select('profiles(email, full_name)').eq('id', booking.teacher_id).single(),
          supabase.from('profiles').select('full_name, email').eq('id', booking.student_id).single(),
        ])
        const teacherContact = (teacherProfile as any)?.profiles
        if (teacherContact?.email) {
          await sendNewBookingRequestEmail({
            to: teacherContact.email,
            teacherName: teacherContact.full_name || 'there',
            studentName: (studentProfile as any)?.full_name || (studentProfile as any)?.email || 'A student',
            subject: booking.subject,
            startAt: booking.start_at,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/teacher/dashboard`,
          })
        }
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session
    const checkoutId = session.id
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_checkout_session_id', checkoutId)
      .single<PaymentRow>()

    if (payment) {
      await supabase.from('bookings').update({ status: 'cancelled' } as Database['public']['Tables']['bookings']['Update']).eq('id', payment.booking_id)
      await supabase.from('payments').update({ status: 'failed' } as Database['public']['Tables']['payments']['Update']).eq('id', payment.id)
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .single<PaymentRow>()

    if (payment) {
      await supabase.from('bookings').update({ status: 'cancelled' } as Database['public']['Tables']['bookings']['Update']).eq('id', payment.booking_id)
      await supabase.from('payments').update({ status: 'failed' } as Database['public']['Tables']['payments']['Update']).eq('id', payment.id)
    }
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    await supabase
      .from('teacher_profiles')
      .update({
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
      } as Database['public']['Tables']['teacher_profiles']['Update'])
      .eq('stripe_account_id', account.id)
  }

  return NextResponse.json({ received: true })
}
