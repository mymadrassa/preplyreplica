import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { refundBookingPayment } from '@/lib/stripe'
import { sendBookingCancelledEmail } from '@/lib/email'

const CANCELLATION_CUTOFF_HOURS = 12

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, teacher_profiles(stripe_account_id, profiles(full_name, email)), profiles!student_id(full_name, email)')
    .eq('id', params.id)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  if (booking.student_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: `This booking is ${booking.status} and can't be cancelled.` }, { status: 409 })
  }

  const hoursUntilStart = (new Date(booking.start_at).getTime() - Date.now()) / (60 * 60 * 1000)
  if (hoursUntilStart < CANCELLATION_CUTOFF_HOURS) {
    return NextResponse.json(
      { error: `This lesson starts in less than ${CANCELLATION_CUTOFF_HOURS} hours and can no longer be cancelled.` },
      { status: 409 }
    )
  }

  const { data: payment } = await supabase.from('payments').select('*').eq('booking_id', booking.id).single()
  const teacherAccountId = (booking as any).teacher_profiles?.stripe_account_id
  if (!payment?.stripe_payment_intent_id || !teacherAccountId) {
    return NextResponse.json({ error: 'Payment record is missing for this booking' }, { status: 500 })
  }

  try {
    await refundBookingPayment(payment.stripe_payment_intent_id, teacherAccountId)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unable to process the refund' }, { status: 502 })
  }

  await supabase.from('bookings').update({ status: 'cancelled' } as any).eq('id', booking.id)
  await supabase.from('payments').update({ status: 'refunded' } as any).eq('id', payment.id)

  const teacherContact = (booking as any).teacher_profiles?.profiles
  if (teacherContact?.email) {
    await sendBookingCancelledEmail({
      to: teacherContact.email,
      teacherName: teacherContact.full_name || 'there',
      studentName: (booking as any).profiles?.full_name || (booking as any).profiles?.email || 'Your student',
      subject: booking.subject,
      startAt: booking.start_at,
    })
  }

  return NextResponse.json({ status: 'cancelled' })
}
