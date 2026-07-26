import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function GET(req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: teacherProfile } = await supabase
    .from('teacher_profiles')
    .select('stripe_account_id')
    .eq('user_id', user.id)
    .single()

  if (!teacherProfile?.stripe_account_id) {
    return NextResponse.json({
      onboarded: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    })
  }

  const account = await stripe.accounts.retrieve(teacherProfile.stripe_account_id)

  await supabase
    .from('teacher_profiles')
    .update({
      stripe_charges_enabled: account.charges_enabled,
      stripe_payouts_enabled: account.payouts_enabled,
    })
    .eq('stripe_account_id', teacherProfile.stripe_account_id)

  return NextResponse.json({
    onboarded: true,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  })
}
