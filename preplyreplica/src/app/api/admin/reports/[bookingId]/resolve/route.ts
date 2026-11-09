import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { paymentRefFor } from '@/lib/payments'
import { returnPackageLesson } from '@/lib/packages'
import { loadPayoutAmount } from '@/lib/lessonPayouts'
import { monthlyPayoutDateFor, payoutAfterPartialRefund } from '@/lib/payouts'
import { loadParticipants } from '@/lib/participantNames'
import { sendAdminMessage } from '@/lib/support'
import { formatBookingDateTime } from '@/lib/format'
import { toPounds } from '@/lib/pricing'

const resolveSchema = z.object({
  resolution: z.enum(['pay_teacher', 'refund_student', 'refund_partial']),
  /** Pence, for a partial refund. */
  refundAmount: z.number().int().positive().optional(),
  /** Shown to both sides with the decision. */
  note: z.string().trim().max(4000).optional(),
})

/**
 * An admin's decision on a reported lesson, closing all its open reports:
 *   - pay the teacher: the lesson is paid with the next monthly payout
 *     (a trial lesson, on its own at the next daily run);
 *   - refund the student: the card is refunded (or the lesson goes back to
 *     the package) and the teacher isn't paid for it;
 *   - partial refund: part of the payment goes back to the student, the
 *     teacher is paid the rest of their share.
 * Both sides get the decision in their Admin conversation.
 */
export async function POST(request: Request, { params }: { params: { bookingId: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const adminId = session.data?.session?.user?.id
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', adminId).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = resolveSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid decision.' }, { status: 400 })
  }
  const { resolution, refundAmount, note } = parsed.data

  const db = createSupabaseServiceRoleClient()
  const [{ data: booking }, { data: openReports }] = await Promise.all([
    db.from('bookings').select('*, teacher_profiles(payout_account_id)').eq('id', params.bookingId).maybeSingle(),
    db.from('lesson_reports').select('id').eq('booking_id', params.bookingId).eq('status', 'open'),
  ])
  if (!booking) return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 })
  if (!openReports?.length) return NextResponse.json({ error: 'This lesson has no open report.' }, { status: 409 })
  if (booking.payout_state === 'paid' || booking.payout_state === 'refunded') {
    return NextResponse.json({ error: `This lesson is already ${booking.payout_state}.` }, { status: 409 })
  }

  const now = new Date().toISOString()
  const { data: payment } = booking.package_id ? { data: null } : await db.from('payments').select('*').eq('booking_id', booking.id).eq('status', 'succeeded').maybeSingle()
  const charge = paymentRefFor(payment, (booking as { teacher_profiles: { payout_account_id: string | null } | null }).teacher_profiles)
  // Lessons the room was still open for count as given once decided.
  const lessonStatus = booking.status === 'confirmed' || booking.status === 'completed' ? 'completed' : booking.status

  const nextPay = booking.is_trial ? 'within a day' : `with your monthly payout on ${monthlyPayoutDateFor(booking.end_at, new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`
  let decisionForStudent: string
  let decisionForTeacher: string
  let refunded: number | null = null

  try {
    if (resolution === 'pay_teacher') {
      const amount = booking.payout_amount ?? (await loadPayoutAmount(db, booking))
      if (amount == null) return NextResponse.json({ error: 'No payment found for this lesson.' }, { status: 409 })
      await db
        .from('bookings')
        .update({ status: lessonStatus, payout_state: 'scheduled', payout_amount: amount, payout_eligible_at: booking.payout_eligible_at ?? now })
        .eq('id', booking.id)
      decisionForStudent = 'the lesson counts as given and is paid to the teacher.'
      decisionForTeacher = `the lesson is paid to you ${nextPay}.`
    } else if (resolution === 'refund_student') {
      if (booking.package_id) {
        await returnPackageLesson(booking.package_id)
        decisionForStudent = 'the lesson has been returned to your package, so you can book it again.'
      } else {
        if (!payment || !charge) return NextResponse.json({ error: 'No captured payment found to refund.' }, { status: 409 })
        await charge.provider.refundPayment(charge.ref)
        await db.from('payments').update({ status: 'refunded', refunded_amount: payment.amount }).eq('id', payment.id)
        refunded = payment.amount
        decisionForStudent = `you've been fully refunded (£${toPounds(payment.amount).toFixed(2)}). It can take a few days to reach your card.`
      }
      await db.from('bookings').update({ status: 'cancelled', payout_state: 'refunded', payout_amount: 0 }).eq('id', booking.id)
      decisionForTeacher = 'the student is refunded, so this lesson isn’t paid.'
    } else {
      if (booking.package_id) {
        return NextResponse.json({ error: 'A package lesson can’t be partly refunded: return it to the package or pay the teacher.' }, { status: 400 })
      }
      if (!payment || !charge) return NextResponse.json({ error: 'No captured payment found to refund.' }, { status: 409 })
      if (!refundAmount || refundAmount >= payment.amount) {
        return NextResponse.json({ error: `Choose an amount below the £${toPounds(payment.amount).toFixed(2)} paid (or refund in full).` }, { status: 400 })
      }
      await charge.provider.refundPayment(charge.ref, { amount: refundAmount })
      await db.from('payments').update({ refunded_amount: payment.refunded_amount + refundAmount }).eq('id', payment.id)
      const teacherShare = payoutAfterPartialRefund(payment.teacher_fee, refundAmount, payment.amount)
      await db
        .from('bookings')
        .update({ status: lessonStatus, payout_state: 'scheduled', payout_amount: teacherShare, payout_eligible_at: booking.payout_eligible_at ?? now })
        .eq('id', booking.id)
      refunded = refundAmount
      decisionForStudent = `you've been refunded £${toPounds(refundAmount).toFixed(2)}. It can take a few days to reach your card.`
      decisionForTeacher = `the student is partly refunded; you're paid £${toPounds(teacherShare).toFixed(2)} for this lesson ${nextPay}.`
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error)?.message || 'The refund failed.' }, { status: 502 })
  }

  await db
    .from('lesson_reports')
    .update({ status: 'resolved', resolution, refund_amount: refunded, admin_note: note || null, resolved_by: adminId, resolved_at: now })
    .eq('booking_id', booking.id)
    .eq('status', 'open')

  const people = await loadParticipants([booking.student_id, booking.teacher_id])
  const lesson = (other: string) => `your ${booking.subject} lesson with ${other} (${formatBookingDateTime(booking.start_at)})`
  const withNote = note ? `\n\n${note}` : ''
  await Promise.all([
    sendAdminMessage(booking.student_id, adminId, `We've reviewed the problem reported on ${lesson(people.get(booking.teacher_id)?.name ?? 'your teacher')}. Our decision: ${decisionForStudent}${withNote}`),
    sendAdminMessage(booking.teacher_id, adminId, `We've reviewed the problem reported on ${lesson(people.get(booking.student_id)?.name ?? 'your student')}. Our decision: ${decisionForTeacher}${withNote}`),
  ])

  return NextResponse.json({ status: 'resolved' })
}
