// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/lib/stripe.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
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
    // Funds stay in the connected account's Stripe balance instead of
    // auto-transferring to their bank — the platform explicitly pays them
    // out (via payoutToTeacherAccount) only once a booked session completes.
    settings: {
      payouts: {
        schedule: {
          interval: 'manual',
        },
      },
    },
  })
}

export async function createTeacherConnectAccountLink(accountId: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/teacher/onboarding`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/teacher/dashboard?stripe_onboarding=success`,
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
  // teacher's account directly (Stripe's processing fee is deducted from
  // their balance automatically). `application_fee_amount` is the platform's
  // cut, pulled from that same balance into the platform's account — sized
  // so the teacher still ends up with their full base rate after Stripe's
  // fee (see lib/pricing.ts).
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
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
        // Authorize the card without charging it yet — the booking only
        // moves to 'confirmed' (and the charge is captured) once the
        // teacher approves the request. Rejecting or timing out cancels
        // the authorization instead, so a declined request never charges
        // the student at all.
        capture_method: 'manual',
      },
      metadata: { bookingId },
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

// The three functions below all act on a PaymentIntent that lives on the
// teacher's connected account (direct charges), so every call needs the
// `stripeAccount` request option — without it Stripe can't find the
// PaymentIntent at all (it isn't visible from the platform account).

/** Captures a previously-authorized (manual capture) payment once the teacher approves the booking. */
export async function captureBookingPayment(paymentIntentId: string, teacherAccountId: string) {
  return stripe.paymentIntents.capture(paymentIntentId, {}, { stripeAccount: teacherAccountId })
}

/** Releases an authorization hold without charging the card — used when the teacher rejects a request, or it times out unanswered. */
export async function cancelBookingPayment(paymentIntentId: string, teacherAccountId: string) {
  return stripe.paymentIntents.cancel(paymentIntentId, { stripeAccount: teacherAccountId })
}

/** Refunds an already-captured payment — used for student cancellations of a confirmed booking. */
export async function refundBookingPayment(paymentIntentId: string, teacherAccountId: string) {
  return stripe.refunds.create({ payment_intent: paymentIntentId }, { stripeAccount: teacherAccountId })
}

/** Pays out a specific amount from a teacher's connected-account balance to their bank account. */
export async function payoutToTeacherAccount(teacherAccountId: string, amount: number) {
  return stripe.payouts.create(
    {
      amount,
      currency: 'gbp',
    },
    {
      stripeAccount: teacherAccountId,
    }
  )
}

export function constructStripeEvent(payload: string, signature: string, secret: string) {
  return stripe.webhooks.constructEvent(payload, signature, secret)
}

export { stripe }
