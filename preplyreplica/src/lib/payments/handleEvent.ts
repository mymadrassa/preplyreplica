// What a payment event means for bookings, whichever provider sent it.
import { revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { TEACHER_CATALOGUE_TAG } from '@/lib/teacherCatalogue'
import { emailTeacherNewRequest } from '@/lib/bookable'
import { sendPackagePurchasedEmails } from '@/lib/email'
import { PACKAGE, toPounds } from '@/lib/pricing'
import type { PaymentEvent, PaymentProviderId } from './types'

type Tables = Database['public']['Tables']
type PaymentRow = Tables['payments']['Row']

export async function handlePaymentEvent(event: PaymentEvent, providerId: PaymentProviderId): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()

  const findPayment = (column: 'provider_checkout_id' | 'provider_payment_id', value: string) =>
    supabase.from('payments').select('*').eq('provider', providerId).eq(column, value).maybeSingle<PaymentRow>()

  const cancelBooking = async (payment: PaymentRow) => {
    await supabase
      .from('bookings')
      .update({ status: 'cancelled' } as Tables['bookings']['Update'])
      .eq('id', payment.booking_id)
    await supabase
      .from('payments')
      .update({ status: 'failed' } as Tables['payments']['Update'])
      .eq('id', payment.id)
  }

  // A checkout is either a single lesson (payments) or a package (lesson_packages).
  const dropUnpaidPackage = async (column: 'provider_checkout_id' | 'provider_payment_id', value: string) => {
    await supabase.from('lesson_packages').update({ status: 'cancelled' }).eq('provider', providerId).eq(column, value).eq('status', 'pending_payment')
  }

  switch (event.type) {
    case 'checkout.completed': {
      const { data: payment } = await findPayment('provider_checkout_id', event.checkoutId)
      if (!payment) return activatePackage(providerId, event.checkoutId, event.paymentId)
      const { data: booking } = await supabase.from('bookings').select('teacher_id').eq('id', payment.booking_id).single()

      // Authorized, not charged yet: the booking now waits on the teacher's approval.
      await supabase
        .from('bookings')
        .update({ status: 'pending' } as Tables['bookings']['Update'])
        .eq('id', payment.booking_id)
      await supabase
        .from('payments')
        .update({
          status: 'authorized',
          // The payment id isn't always known when checkout starts; it is by now.
          provider_payment_id: payment.provider_payment_id ?? event.paymentId,
        } as Tables['payments']['Update'])
        .eq('id', payment.id)

      if (booking?.teacher_id) await emailTeacherNewRequest(payment.booking_id)
      return
    }

    case 'checkout.expired': {
      const { data: payment } = await findPayment('provider_checkout_id', event.checkoutId)
      if (payment) await cancelBooking(payment)
      else await dropUnpaidPackage('provider_checkout_id', event.checkoutId)
      return
    }

    case 'payment.failed': {
      const { data: payment } = await findPayment('provider_payment_id', event.paymentId)
      if (payment) await cancelBooking(payment)
      else await dropUnpaidPackage('provider_payment_id', event.paymentId)
      return
    }

    case 'payee.updated': {
      await supabase
        .from('teacher_profiles')
        .update({
          payments_enabled: event.paymentsEnabled,
          payouts_enabled: event.payoutsEnabled,
        } as Tables['teacher_profiles']['Update'])
        .eq('payment_provider', providerId)
        .eq('payout_account_id', event.accountId)
      revalidateTag(TEACHER_CATALOGUE_TAG)
      return
    }
  }
}

// A package is charged at checkout: it becomes usable straight away, for PACKAGE.validityMonths.
async function activatePackage(providerId: PaymentProviderId, checkoutId: string, paymentId: string | null) {
  const supabase = createSupabaseServiceRoleClient()
  const { data: pkg } = await supabase.from('lesson_packages').select('*').eq('provider', providerId).eq('provider_checkout_id', checkoutId).maybeSingle()
  if (!pkg || pkg.status !== 'pending_payment') return
  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + PACKAGE.validityMonths)
  await supabase
    .from('lesson_packages')
    .update({
      status: 'active',
      expires_at: expiresAt.toISOString(),
      provider_payment_id: pkg.provider_payment_id ?? paymentId,
    })
    .eq('id', pkg.id)

  const [{ data: student }, { data: teacher }] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', pkg.student_id).single(),
    supabase.from('profiles').select('full_name, email').eq('id', pkg.teacher_id).single(),
  ])
  await sendPackagePurchasedEmails({
    student: {
      email: student?.email ?? null,
      name: student?.full_name || 'there',
    },
    teacher: {
      email: teacher?.email ?? null,
      name: teacher?.full_name || 'your teacher',
    },
    lessons: pkg.lessons_total,
    price: toPounds(pkg.price),
    expiresAt: expiresAt.toISOString(),
    bookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/teachers/${pkg.teacher_id}`,
  })
}
