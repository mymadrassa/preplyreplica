import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { paymentRefFor } from '@/lib/payments'
import { platformShare } from '@/lib/receipts'

// Once a student's payment is charged, the provider tells us its real card
// fee: we keep it with the payment, with what My Madrassa keeps (the price
// minus the teachers' pay minus that fee), for receipts and statements.

type Db = ReturnType<typeof createSupabaseServiceRoleClient>

/** Records the real fee of a trial's payment (after capture). Best effort: a receipt fetches it later if this fails. */
export async function recordLessonPaymentFees(paymentId: string, db: Db = createSupabaseServiceRoleClient()) {
  const { data: payment } = await db.from('payments').select('*, bookings(teacher_profiles(payout_account_id))').eq('id', paymentId).maybeSingle()
  if (!payment) return null
  const teacher = (payment.bookings as { teacher_profiles: { payout_account_id: string | null } | null } | null)?.teacher_profiles
  const charge = paymentRefFor(payment, teacher)
  if (!charge) return null
  try {
    const { processingFee, cardCountry } = await charge.provider.getPaymentFees(charge.ref)
    const update = {
      processing_fee: processingFee,
      platform_amount: platformShare(payment.amount, payment.teacher_fee, processingFee),
      card_country: cardCountry,
      paid_at: payment.paid_at ?? new Date().toISOString(),
    }
    await db.from('payments').update(update).eq('id', payment.id)
    return { ...payment, ...update }
  } catch (error) {
    console.error('[fees] lesson payment', paymentId, error)
    return null
  }
}

/** Records the real fee of a package's payment (after checkout). Best effort, like the above. */
export async function recordPackagePaymentFees(packageId: string, db: Db = createSupabaseServiceRoleClient()) {
  const { data: pkg } = await db.from('lesson_packages').select('*, teacher_profiles(payout_account_id)').eq('id', packageId).maybeSingle()
  if (!pkg) return null
  const charge = paymentRefFor(pkg, pkg.teacher_profiles as { payout_account_id: string | null } | null)
  if (!charge) return null
  try {
    const { processingFee, cardCountry } = await charge.provider.getPaymentFees(charge.ref)
    const update = {
      processing_fee: processingFee,
      platform_amount: platformShare(pkg.price, pkg.teacher_fee_per_lesson * pkg.lessons_total, processingFee),
      card_country: cardCountry,
      paid_at: pkg.paid_at ?? new Date().toISOString(),
    }
    await db.from('lesson_packages').update(update).eq('id', pkg.id)
    return { ...pkg, ...update }
  } catch (error) {
    console.error('[fees] package payment', packageId, error)
    return null
  }
}
