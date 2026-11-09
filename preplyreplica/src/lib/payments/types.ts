// The contract every payment provider implements. Booking logic, pages and
// the database only ever talk to this, never to a provider's SDK, so a
// provider can be replaced by writing one adapter (see ./stripe.ts).
//
// Amounts are integers in minor units (pence) unless named otherwise.

export type PaymentProviderId = 'stripe'

export type Currency = 'gbp'

/**
 * Enough to act on one payment: its id and the account it was charged on.
 * `payeeAccountId` is null for payments charged on My Madrassa's own account
 * (the normal case since migration 0044); older payments were charged on the
 * teacher's payout account.
 */
export interface PaymentRef {
  paymentId: string
  payeeAccountId: string | null
}

/** A checkout on My Madrassa's own account: the student pays My Madrassa, which pays the teacher later (transfer + payout). */
export interface CheckoutInput {
  amount: number
  currency: Currency
  /**
   * 'manual' authorizes now and charges on capturePayment (a lesson, charged
   * when the teacher accepts); 'automatic' charges at once (a package).
   */
  capture: 'manual' | 'automatic'
  /** What's being bought, shown on the checkout page (e.g. "Lesson booking"). */
  description: string
  /** Our id for it (booking or package), kept with the payment for reconciliation. */
  reference: string
  /** Extra ids kept with the payment (e.g. the teacher's). */
  metadata?: Record<string, string>
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
  /** Asks the provider directly whether the account can take payments and pay out (no webhook needed). */
  getPayeeStatus(accountId: string): Promise<{ paymentsEnabled: boolean; payoutsEnabled: boolean }>
  /** Asks the provider how a checkout ended, as payment events (no webhook needed); [] while it's still open. */
  getCheckoutEvents(checkoutId: string, payeeAccountId: string | null): Promise<PaymentEvent[]>

  // Payments from students: authorized at checkout (a trial is captured when the teacher accepts)
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  capturePayment(ref: PaymentRef): Promise<void>
  /** Releases an authorization without charging. */
  cancelPayment(ref: PaymentRef): Promise<void>
  /** Refunds a captured payment, in full or `amount` of it. */
  refundPayment(ref: PaymentRef, options?: { amount?: number }): Promise<void>
  /** What the provider really charged on a captured payment, and the card's country (ISO code), for receipts. */
  getPaymentFees(ref: PaymentRef): Promise<{ processingFee: number; cardCountry: string | null }>

  // Paying teachers: My Madrassa transfers what it owes into the teacher's payout account, then pays it out to their bank.
  /**
   * Moves money from My Madrassa's balance to a teacher's payout account.
   * `sourcePaymentId` ties it to one student payment, so it can go before that
   * money is available on our balance. Safe to retry with the same `idempotencyKey`.
   */
  transfer(input: { payeeAccountId: string; amount: number; currency: Currency; sourcePaymentId?: string | null; idempotencyKey: string; description?: string }): Promise<{ transferId: string }>
  /** Sends money from a teacher's payout account balance to their bank. */
  payout(input: { payeeAccountId: string; amount: number; currency: Currency; idempotencyKey?: string }): Promise<{ payoutId: string }>

  /** Verifies a webhook and translates it; throws if the signature is invalid. Unknown events give []. */
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent[]>
}

/** A provider error worth showing to the user (falls back to a generic message). */
export function paymentErrorMessage(error: unknown, fallback: string): string {
  const e = error as { raw?: { message?: string }; message?: string } | null
  return e?.raw?.message || e?.message || fallback
}
