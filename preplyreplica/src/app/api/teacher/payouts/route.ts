import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getPaymentProvider, paymentErrorMessage } from '@/lib/payments'
import { startPayoutSetup } from '@/lib/payments/payoutSetup'

/**
 * Starts or continues payout account setup on its own, without
 * re-sending the profile. Payouts don't need review, so this works whatever
 * the profile's status.
 */
export async function POST() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const user = session.data?.session?.user
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: teacher } = await supabase.from('teacher_profiles').select('payout_account_id, payment_provider, payments_enabled').eq('id', user.id).maybeSingle()
  if (!teacher) {
    return NextResponse.json({ error: 'Finish your teacher profile first.' }, { status: 409 })
  }
  if (teacher.payments_enabled) {
    return NextResponse.json({ error: 'Payouts are already set up.' }, { status: 409 })
  }

  try {
    const { url } = await startPayoutSetup({ id: user.id, email: user.email || '', ...teacher })
    return NextResponse.json({ onboardingUrl: url })
  } catch (error) {
    return NextResponse.json({ error: paymentErrorMessage(error, `Unable to set up ${getPaymentProvider().displayName} payouts.`) }, { status: 502 })
  }
}
