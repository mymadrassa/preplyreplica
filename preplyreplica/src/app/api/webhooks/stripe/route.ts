// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/api/webhooks/stripe/route.ts
import type Stripe from 'stripe'
import type { Database } from '@/types/database'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { constructStripeEvent } from '@/lib/stripe'

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
      await supabase.from('bookings').update({ status: 'confirmed' } as Database['public']['Tables']['bookings']['Update']).eq('id', payment.booking_id)
      await supabase.from('payments').update({ status: 'succeeded' } as Database['public']['Tables']['payments']['Update']).eq('id', payment.id)
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
    await supabase.from('teacher_profiles').update({ stripe_account_id: account.id } as Database['public']['Tables']['teacher_profiles']['Update']).eq('stripe_account_id', account.id)
  }

  return NextResponse.json({ received: true })
}
