import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'

import { toPaymentEvents } from '../stripe'
import { getPaymentProvider, paymentRefFor } from '../index'

const event = (type: string, object: object) => ({ type, data: { object } }) as unknown as Stripe.Event

describe('toPaymentEvents (Stripe)', () => {
  it('maps a completed checkout, even while the payment is only authorized', () => {
    expect(toPaymentEvents(event('checkout.session.completed', { id: 'cs_1', status: 'complete', payment_status: 'unpaid', payment_intent: 'pi_1' }))).toEqual([
      { type: 'checkout.completed', checkoutId: 'cs_1', paymentId: 'pi_1' },
    ])
  })

  it('ignores a checkout that did not complete', () => {
    expect(toPaymentEvents(event('checkout.session.completed', { id: 'cs_1', status: 'open' }))).toEqual([])
  })

  it('maps expiry, failure and account updates', () => {
    expect(toPaymentEvents(event('checkout.session.expired', { id: 'cs_2' }))).toEqual([{ type: 'checkout.expired', checkoutId: 'cs_2' }])
    expect(toPaymentEvents(event('payment_intent.payment_failed', { id: 'pi_3' }))).toEqual([{ type: 'payment.failed', paymentId: 'pi_3' }])
    expect(toPaymentEvents(event('account.updated', { id: 'acct_1', charges_enabled: true, payouts_enabled: false }))).toEqual([
      { type: 'payee.updated', accountId: 'acct_1', paymentsEnabled: true, payoutsEnabled: false },
    ])
  })

  it('ignores events it does not use', () => {
    expect(toPaymentEvents(event('customer.created', { id: 'cus_1' }))).toEqual([])
  })
})

describe('provider registry', () => {
  it('defaults to Stripe and rejects unknown providers', () => {
    expect(getPaymentProvider(null).id).toBe('stripe')
    expect(() => getPaymentProvider('nope')).toThrow('Unknown payment provider')
  })

  it('builds a payment reference only when both ids are known', () => {
    const teacher = { payout_account_id: 'acct_1' }
    expect(paymentRefFor({ provider: 'stripe', provider_payment_id: 'pi_1' }, teacher)?.ref).toEqual({ paymentId: 'pi_1', payeeAccountId: 'acct_1' })
    expect(paymentRefFor({ provider: 'stripe', provider_payment_id: null }, teacher)).toBeNull()
    expect(paymentRefFor({ provider: 'stripe', provider_payment_id: 'pi_1' }, { payout_account_id: null })).toBeNull()
  })
})
