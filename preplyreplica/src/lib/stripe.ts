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
  applicationFeeAmount,
  teacherAccountId,
  bookingId,
  successUrl,
  cancelUrl,
}: {
  amount: number
  applicationFeeAmount: number
  teacherAccountId: string
  bookingId: string
  successUrl: string
  cancelUrl: string
}) {
  // Direct charge: the session is created on the connected (teacher) account
  // itself via the `stripeAccount` request option, so the customer pays the
  // teacher's account directly (and Stripe's processing fee is deducted from
  // their balance, matching this account's fees_collector: account setting).
  // `application_fee_amount` is the platform's cut, automatically pulled
  // from that same balance into the platform's account.
  const session = await stripe.checkout.sessions.create(
    {
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
        application_fee_amount: applicationFeeAmount,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    },
    {
      stripeAccount: teacherAccountId,
    }
  )

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
