// The contract every payment provider implements. Booking logic, pages and
// the database only ever talk to this, never to a provider's SDK, so a
// provider can be replaced by writing one adapter (see ./stripe.ts).
//
// Amounts are integers in minor units (pence) unless named otherwise.

export type PaymentProviderId = 'stripe'

export type Currency = 'gbp'

/** Enough to act on one payment: where it lives and whose payout account received it. */
export interface PaymentRef {
  paymentId: string
  payeeAccountId: string
}

export interface CheckoutInput {
  amount: number
  /** The platform's cut, kept from the amount. */
  platformFee: number
  currency: Currency
  /** The teacher's payout account the student pays into. */
  payeeAccountId: string
  /**
   * 'manual' authorizes now and charges on capturePayment (a lesson, charged
   * when the teacher accepts); 'automatic' charges at once (a package).
   */
  capture: 'manual' | 'automatic'
  /** What's being bought, shown on the checkout page (e.g. "Lesson booking"). */
  description: string
  /** Our id for it (booking or package), kept with the payment for reconciliation. */
  reference: string
  successUrl: string
  cancelUrl: string
}

export interface CheckoutResult {
  /** Where to send the student to pay. */
  url: string
  checkoutId: string
  /** The payment's id, when the provider knows it already (else it arrives with checkout.completed). */
  paymentId: string | null
}

/** What a provider's webhooks mean for us, whatever the provider's own vocabulary. */
export type PaymentEvent =
  /** The student paid: the amount is authorized, to be captured when the teacher accepts. */
  | { type: 'checkout.completed'; checkoutId: string; paymentId: string | null }
  | { type: 'checkout.expired'; checkoutId: string }
  | { type: 'payment.failed'; paymentId: string }
  /** A teacher's payout account changed (e.g. finished onboarding). */
  | { type: 'payee.updated'; accountId: string; paymentsEnabled: boolean; payoutsEnabled: boolean }

export interface PaymentProvider {
  id: PaymentProviderId
  /** Shown to users where the processor is named ("You'll be taken to …"). */
  displayName: string
  /** Typical card fee, for the processing-fee estimate in pricing (pounds). */
  fees: { percentage: number; fixed: number }

  // Teacher payout accounts
  createPayeeAccount(input: { email: string; country?: string }): Promise<{ accountId: string }>
  createPayeeOnboardingLink(accountId: string, urls: { returnUrl: string; refreshUrl: string }): Promise<{ url: string }>

  // Booking payments: authorized at checkout, captured when the teacher accepts
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  capturePayment(ref: PaymentRef): Promise<void>
  /** Releases an authorization without charging. */
  cancelPayment(ref: PaymentRef): Promise<void>
  /** Refunds a captured payment, in full or `amount` of it (the platform's share is refunded proportionally). */
  refundPayment(ref: PaymentRef, options?: { amount?: number }): Promise<void>
  /** Sends money from a teacher's payout account balance to their bank. */
  payout(input: { payeeAccountId: string; amount: number; currency: Currency }): Promise<void>

  /** Verifies a webhook and translates it; throws if the signature is invalid. Unknown events give []. */
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent[]>
}

/** A provider error worth showing to the user (falls back to a generic message). */
export function paymentErrorMessage(error: unknown, fallback: string): string {
  const e = error as { raw?: { message?: string }; message?: string } | null
  return e?.raw?.message || e?.message || fallback
}
