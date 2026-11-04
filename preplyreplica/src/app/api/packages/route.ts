import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { getPaymentProvider, paymentErrorMessage } from '@/lib/payments'
import { PACKAGE, isTier, packagePrice, toPence } from '@/lib/pricing'
import { loadBookableTeacher } from '@/lib/bookable'
import { TRIAL_FIRST_MESSAGE, hasHadFirstLesson } from '@/lib/trialRule'

const schema = z.object({ teacherId: z.string().uuid() })

/**
 * Buys a 10-lesson package with a teacher: paid upfront (charged at once) at
 * 10% off. The teacher is paid per completed lesson; the platform's share is
 * the discounted margin.
 */
export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }
  const { teacherId } = parsed.data

  const bookable = await loadBookableTeacher(supabase, userId, teacherId)
  if ('error' in bookable) return NextResponse.json({ error: bookable.error }, { status: bookable.status })
  const { teacher } = bookable
  if (!(await hasHadFirstLesson(supabase, userId, teacherId))) {
    return NextResponse.json({ error: `${TRIAL_FIRST_MESSAGE} Book it first, then choose your package.` }, { status: 409 })
  }

  const service = createSupabaseServiceRoleClient()
  const { data: live } = await service
    .from('lesson_packages')
    .select('id, status')
    .eq('student_id', userId)
    .eq('teacher_id', teacherId)
    .in('status', ['pending_payment', 'active'])
    .maybeSingle()
  if (live?.status === 'active') {
    return NextResponse.json({ error: 'You already have a package with this teacher.' }, { status: 409 })
  }
  // An abandoned checkout from earlier is replaced by this one.
  if (live) await service.from('lesson_packages').update({ status: 'cancelled' }).eq('id', live.id)

  const provider = getPaymentProvider(teacher.payment_provider)
  const tier = isTier(teacher.tier) ? teacher.tier : 'starter'
  const pricing = packagePrice(teacher.hourly_rate, tier, provider.fees)

  const { data: pkg, error } = await service
    .from('lesson_packages')
    .insert({
      student_id: userId,
      teacher_id: teacherId,
      lessons_total: PACKAGE.lessons,
      price: toPence(pricing.price),
      teacher_fee_per_lesson: toPence(pricing.teacherPerLesson),
      refund_per_lesson: toPence(pricing.perLesson),
      tier,
      provider: provider.id,
    })
    .select('id')
    .single()
  if (error || !pkg) {
    return NextResponse.json({ error: error?.message || 'Unable to start the package purchase.' }, { status: 500 })
  }

  try {
    const { url, checkoutId, paymentId } = await provider.createCheckout({
      amount: toPence(pricing.price),
      platformFee: Math.max(0, toPence(pricing.platformNet)),
      currency: 'gbp',
      payeeAccountId: teacher.payout_account_id,
      capture: 'automatic',
      description: `${PACKAGE.lessons}-lesson package`,
      reference: pkg.id,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/student/bookings?package=success`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/teachers/${teacherId}`,
    })
    await service.from('lesson_packages').update({ provider_checkout_id: checkoutId, provider_payment_id: paymentId }).eq('id', pkg.id)
    return NextResponse.json({ checkoutUrl: url })
  } catch (checkoutError) {
    await service.from('lesson_packages').update({ status: 'cancelled' }).eq('id', pkg.id)
    return NextResponse.json({ error: paymentErrorMessage(checkoutError, 'Unable to start checkout.') }, { status: 502 })
  }
}
