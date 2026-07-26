import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: teacherProfile, error } = await supabase
    .from('teacher_profiles')
    .select('id, stripe_account_id')
    .eq('user_id', user.id)
    .single()

  if (error || !teacherProfile) {
    return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 })
  }

  let accountId = teacherProfile.stripe_account_id

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'GB',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
    })

    accountId = account.id

    await supabase
      .from('teacher_profiles')
      .update({ stripe_account_id: accountId })
      .eq('id', teacherProfile.id)
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/teacher/onboarding?refresh=true`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/teacher/onboarding?success=true`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: accountLink.url })
}
