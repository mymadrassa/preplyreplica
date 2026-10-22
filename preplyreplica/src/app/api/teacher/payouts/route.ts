import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createTeacherConnectAccount, createTeacherConnectAccountLink } from '@/lib/stripe'

/**
 * Starts or continues Stripe Connect onboarding on its own, without
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

  const { data: teacher } = await supabase.from('teacher_profiles').select('stripe_account_id, stripe_charges_enabled').eq('id', user.id).maybeSingle()
  if (!teacher) {
    return NextResponse.json({ error: 'Finish your teacher profile first.' }, { status: 409 })
  }
  if (teacher.stripe_charges_enabled) {
    return NextResponse.json({ error: 'Stripe is already connected.' }, { status: 409 })
  }

  try {
    let accountId = teacher.stripe_account_id
    if (!accountId) {
      const account = await createTeacherConnectAccount(user.email || '')
      accountId = account.id
      await supabase.from('teacher_profiles').update({ stripe_account_id: accountId }).eq('id', user.id)
    }
    const link = await createTeacherConnectAccountLink(accountId)
    return NextResponse.json({ onboardingUrl: link.url })
  } catch (stripeError: any) {
    return NextResponse.json({ error: stripeError?.raw?.message || stripeError?.message || 'Unable to set up Stripe payouts.' }, { status: 502 })
  }
}
