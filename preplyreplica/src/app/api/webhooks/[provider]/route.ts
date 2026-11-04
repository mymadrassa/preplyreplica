import { NextResponse } from 'next/server'
import { getPaymentProvider, isPaymentProviderId, type PaymentEvent } from '@/lib/payments'
import { handlePaymentEvent } from '@/lib/payments/handleEvent'

/**
 * Payment webhooks for any provider: /api/webhooks/stripe, and later
 * /api/webhooks/<name>. The provider verifies and translates its own events;
 * what they mean for bookings lives in handlePaymentEvent. (Static routes
 * such as /api/webhooks/whatsapp take precedence over this one.)
 */
export async function POST(request: Request, { params }: { params: { provider: string } }) {
  if (!isPaymentProviderId(params.provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }
  const provider = getPaymentProvider(params.provider)

  let events: PaymentEvent[]
  try {
    events = await provider.parseWebhook(await request.text(), request.headers)
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  for (const event of events) {
    await handlePaymentEvent(event, provider.id)
  }
  return NextResponse.json({ received: true })
}
