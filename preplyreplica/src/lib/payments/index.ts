// Entry point for payments: pick a provider, never import one directly.
//
// Adding a provider: implement PaymentProvider in ./<name>.ts, register it
// below, set PAYMENT_PROVIDER=<name> for new accounts and payments, and point
// its webhooks at /api/webhooks/<name>. Existing rows keep their own
// `provider` / `payment_provider`, so their refunds and captures still go to
// the provider that holds them.
import { stripeProvider } from './stripe'
import type { PaymentProvider, PaymentProviderId, PaymentRef } from './types'

export * from './types'

const PROVIDERS: Record<PaymentProviderId, PaymentProvider> = {
  stripe: stripeProvider,
}

export function isPaymentProviderId(id: string): id is PaymentProviderId {
  return id in PROVIDERS
}

/** The provider for an existing row (by its stored id), or the one new payments use. */
export function getPaymentProvider(id: string | null | undefined = process.env.PAYMENT_PROVIDER): PaymentProvider {
  const key = id || 'stripe'
  if (!isPaymentProviderId(key)) throw new Error(`Unknown payment provider: ${key}`)
  return PROVIDERS[key]
}

/**
 * The provider and reference for acting on a payment (a lesson's or a
 * package's); null when it can't be acted on yet. Payments charged on My
 * Madrassa's account need no teacher account; older direct charges do.
 */
export function paymentRefFor(
  payment: { provider?: string | null; provider_payment_id: string | null; charge_model?: string | null } | null | undefined,
  teacher: { payout_account_id: string | null } | null | undefined
): { provider: PaymentProvider; ref: PaymentRef } | null {
  if (!payment?.provider_payment_id) return null
  const onPlatform = payment.charge_model === 'platform'
  if (!onPlatform && !teacher?.payout_account_id) return null
  return { provider: getPaymentProvider(payment.provider), ref: { paymentId: payment.provider_payment_id, payeeAccountId: onPlatform ? null : (teacher?.payout_account_id ?? null) } }
}
