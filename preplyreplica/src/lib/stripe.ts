// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/lib/stripe.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export async function createTeacherConnectAccount(email: string, country?: string) {
  const accountCountry = country || process.env.STRIPE_ACCOUNT_COUNTRY || 'US'
  return stripe.accounts.create({
    type: 'express',
    country: accountCountry,
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  })
}

export async function createTeacherConnectAccountLink(accountId: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/teacher/onboarding`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/teacher/dashboard`,
    type: 'account_onboarding',
  })
}

export async function createBookingCheckoutSession({
  amount,
  teacherAccountId,
  bookingId,
  successUrl,
  cancelUrl,
}: {
  amount: number
  teacherAccountId: string
  bookingId: string
  successUrl: string
  cancelUrl: string
}) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Lesson booking',
            description: `Booking ${bookingId}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      transfer_data: {
        destination: teacherAccountId,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return {
    url: session.url,
    sessionId: session.id,
    paymentIntent: session.payment_intent as string,
  }
}

export function constructStripeEvent(payload: string, signature: string, secret: string) {
  return stripe.webhooks.constructEvent(payload, signature, secret)
}

export { stripe }
