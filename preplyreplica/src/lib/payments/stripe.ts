// Stripe adapter: the only file that knows about Stripe. Students pay My
// Madrassa's own Stripe account (it sells the lessons); teachers have Stripe
// Connect Express accounts that My Madrassa transfers their pay into, then
// pays out to their bank. Payments from before migration 0044 were direct
// charges on the teacher's account: a ref with a payeeAccountId still acts
// there.
import Stripe from 'stripe'
import type { PaymentEvent, PaymentProvider } from './types'

let client: Stripe | null = null

/** Request options for a payment on a teacher's connected account (older direct charges); none for My Madrassa's own. */
function onAccount(payeeAccountId: string | null): Stripe.RequestOptions {
  return payeeAccountId ? { stripeAccount: payeeAccountId } : {}
}
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
      // Transferred pay stays in the teacher's Stripe balance until the
      // platform pays it out explicitly (payout below), on the payout day.
      settings: { payouts: { schedule: { interval: 'manual' } } },
    })
    return { accountId: account.id }
  },

  async getCheckoutEvents(checkoutId, payeeAccountId) {
    const session = await stripe().checkout.sessions.retrieve(checkoutId, {}, onAccount(payeeAccountId))
    if (session.status === 'complete') return [{ type: 'checkout.completed', checkoutId: session.id, paymentId: (session.payment_intent as string | null) ?? null }]
    if (session.status === 'expired') return [{ type: 'checkout.expired', checkoutId: session.id }]
    return []
  },

  async getPayeeStatus(accountId) {
    const account = await stripe().accounts.retrieve(accountId)
    return { paymentsEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled }
  },

  async createPayeeOnboardingLink(accountId, { returnUrl, refreshUrl }) {
    const link = await stripe().accountLinks.create({ account: accountId, refresh_url: refreshUrl, return_url: returnUrl, type: 'account_onboarding' })
    return { url: link.url }
  },

  async createCheckout({ amount, currency, capture, description, reference, metadata, successUrl, cancelUrl }) {
    // On My Madrassa's own account: the student pays My Madrassa, Stripe's
    // card fee comes out of it, and the teacher is paid later by transfer.
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: { currency, product_data: { name: description, description: `Ref ${reference}` }, unit_amount: amount },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: { reference, ...metadata },
        // Lessons: authorize now, charge only when the teacher accepts (a
        // declined or unanswered request releases the hold and never charges).
        // Packages: charged at once (a hold would expire long before they're used).
        capture_method: capture,
      },
      metadata: { reference, ...metadata },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })
    return { url: session.url ?? '', checkoutId: session.id, paymentId: (session.payment_intent as string | null) ?? null }
  },

  // A ref with a payeeAccountId is an older direct charge, living on the
  // teacher's connected account; the rest live on My Madrassa's account.
  async capturePayment({ paymentId, payeeAccountId }) {
    await stripe().paymentIntents.capture(paymentId, {}, onAccount(payeeAccountId))
  },
  async cancelPayment({ paymentId, payeeAccountId }) {
    await stripe().paymentIntents.cancel(paymentId, {}, onAccount(payeeAccountId))
  },
  async refundPayment({ paymentId, payeeAccountId }, { amount } = {}) {
    await stripe().refunds.create(
      // A direct charge also gives back the platform's share, in proportion.
      { payment_intent: paymentId, ...(amount ? { amount } : {}), ...(payeeAccountId ? { refund_application_fee: true } : {}) },
      onAccount(payeeAccountId)
    )
  },

  async getPaymentFees({ paymentId, payeeAccountId }) {
    const intent = await stripe().paymentIntents.retrieve(paymentId, { expand: ['latest_charge.balance_transaction'] }, onAccount(payeeAccountId))
    const charge = intent.latest_charge as Stripe.Charge | null
    const transaction = charge?.balance_transaction as Stripe.BalanceTransaction | null
    // Only Stripe's own fee: on a direct charge `fee` would include the platform's share too.
    const stripeFee = transaction?.fee_details?.filter((d) => d.type === 'stripe_fee').reduce((sum, d) => sum + d.amount, 0) ?? transaction?.fee ?? 0
    return { processingFee: stripeFee, cardCountry: charge?.payment_method_details?.card?.country ?? null }
  },

  async transfer({ payeeAccountId, amount, currency, sourcePaymentId, idempotencyKey, description }) {
    // Tied to the student's charge when there is one, so it doesn't wait for that money to become available.
    let sourceTransaction: string | undefined
    if (sourcePaymentId) {
      const intent = await stripe().paymentIntents.retrieve(sourcePaymentId)
      sourceTransaction = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id
    }
    const transfer = await stripe().transfers.create(
      { amount, currency, destination: payeeAccountId, ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}), ...(description ? { description } : {}) },
      { idempotencyKey }
    )
    return { transferId: transfer.id }
  },

  async payout({ payeeAccountId, amount, currency, idempotencyKey }) {
    const payout = await stripe().payouts.create({ amount, currency }, { stripeAccount: payeeAccountId, ...(idempotencyKey ? { idempotencyKey } : {}) })
    return { payoutId: payout.id }
  },

  async parseWebhook(rawBody, headers) {
    // Two endpoints can point here: My Madrassa's own account (payments) and
    // connected accounts (teachers' payout setup, older direct charges).
    const signature = headers.get('stripe-signature')
    const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((s): s is string => Boolean(s))
    if (!signature || !secrets.length) throw new Error('Missing webhook signature or secret')
    for (const [i, secret] of secrets.entries()) {
      try {
        return toPaymentEvents(stripe().webhooks.constructEvent(rawBody, signature, secret))
      } catch (error) {
        if (i === secrets.length - 1) throw error
      }
    }
    return []
  },
}
