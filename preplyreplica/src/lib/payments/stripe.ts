// Stripe adapter: the only file that knows about Stripe. Teachers have
// Stripe Connect Express accounts; bookings are direct charges on the
// teacher's account with manual capture, and the platform takes an
// application fee.
import Stripe from 'stripe'
import type { PaymentEvent, PaymentProvider } from './types'

let client: Stripe | null = null
function stripe(): Stripe {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' })
  return client
}

/** Stripe's events in our vocabulary; everything else is ignored. Pure, for tests. */
export function toPaymentEvents(event: Stripe.Event): PaymentEvent[] {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // With manual capture Checkout's `payment_status` stays 'unpaid' after a
      // perfectly good checkout; `status === 'complete'` is what confirms it.
      if (session.status !== 'complete') return []
      return [{ type: 'checkout.completed', checkoutId: session.id, paymentId: (session.payment_intent as string | null) ?? null }]
    }
    case 'checkout.session.expired':
      return [{ type: 'checkout.expired', checkoutId: (event.data.object as Stripe.Checkout.Session).id }]
    case 'payment_intent.payment_failed':
      return [{ type: 'payment.failed', paymentId: (event.data.object as Stripe.PaymentIntent).id }]
    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      return [{ type: 'payee.updated', accountId: account.id, paymentsEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled }]
    }
    default:
      return []
  }
}

export const stripeProvider: PaymentProvider = {
  id: 'stripe',
  displayName: 'Stripe',
  // UK/EEA card rate: 1.5% + £0.20
  fees: { percentage: 0.015, fixed: 0.2 },

  async createPayeeAccount({ email, country }) {
    const account = await stripe().accounts.create({
      type: 'express',
      country: country || process.env.STRIPE_ACCOUNT_COUNTRY || 'US',
      email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      // Funds stay in the teacher's Stripe balance instead of auto-transferring
      // to their bank; the platform pays them out explicitly (payout below)
      // once a booked session completes.
      settings: { payouts: { schedule: { interval: 'manual' } } },
    })
    return { accountId: account.id }
  },

  async getPayeeStatus(accountId) {
    const account = await stripe().accounts.retrieve(accountId)
    return { paymentsEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled }
  },

  async createPayeeOnboardingLink(accountId, { returnUrl, refreshUrl }) {
    const link = await stripe().accountLinks.create({ account: accountId, refresh_url: refreshUrl, return_url: returnUrl, type: 'account_onboarding' })
    return { url: link.url }
  },

  async createCheckout({ amount, platformFee, currency, payeeAccountId, capture, description, reference, successUrl, cancelUrl }) {
    // Direct charge: the session is created on the teacher's connected account
    // (`stripeAccount`), so the student pays the teacher directly and Stripe's
    // fee comes out of their balance; `application_fee_amount` is the
    // platform's cut, sized so the teacher still nets their full base rate
    // (see lib/pricing.ts).
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: { currency, product_data: { name: description, description: `Ref ${reference}` }, unit_amount: amount },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: platformFee,
          // Lessons: authorize now, charge only when the teacher accepts (a
          // declined or unanswered request releases the hold and never charges).
          // Packages: charged at once (a hold would expire long before they're used).
          capture_method: capture,
        },
        metadata: { reference },
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      { stripeAccount: payeeAccountId }
    )
    return { url: session.url ?? '', checkoutId: session.id, paymentId: (session.payment_intent as string | null) ?? null }
  },

  // These act on a PaymentIntent living on the teacher's connected account
  // (direct charges), so each needs `stripeAccount` or Stripe can't find it.
  async capturePayment({ paymentId, payeeAccountId }) {
    await stripe().paymentIntents.capture(paymentId, {}, { stripeAccount: payeeAccountId })
  },
  async cancelPayment({ paymentId, payeeAccountId }) {
    await stripe().paymentIntents.cancel(paymentId, { stripeAccount: payeeAccountId })
  },
  async refundPayment({ paymentId, payeeAccountId }, { amount } = {}) {
    await stripe().refunds.create(
      { payment_intent: paymentId, ...(amount ? { amount } : {}), refund_application_fee: true },
      { stripeAccount: payeeAccountId }
    )
  },

  async payout({ payeeAccountId, amount, currency }) {
    await stripe().payouts.create({ amount, currency }, { stripeAccount: payeeAccountId })
  },

  async parseWebhook(rawBody, headers) {
    const signature = headers.get('stripe-signature')
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!signature || !secret) throw new Error('Missing webhook signature or secret')
    return toPaymentEvents(stripe().webhooks.constructEvent(rawBody, signature, secret))
  },
}
