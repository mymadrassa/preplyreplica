import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { captureBookingPayment, cancelBookingPayment } from '@/lib/stripe'
import { sendBookingApprovedEmail, sendBookingRejectedEmail } from '@/lib/email'

const respondSchema = z.object({ action: z.enum(['approve', 'reject']) })

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parseResult = respondSchema.safeParse(await request.json())
  if (!parseResult.success) {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 })
  }
  const { action } = parseResult.data

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, profiles!student_id(full_name, email), teacher_profiles(stripe_account_id, profiles(full_name))')
    .eq('id', params.id)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  if (booking.teacher_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (booking.status !== 'pending') {
    return NextResponse.json({ error: `This booking is ${booking.status}, not awaiting a response.` }, { status: 409 })
  }

  const { data: payment } = await supabase.from('payments').select('*').eq('booking_id', booking.id).single()
  const teacherAccountId = (booking as any).teacher_profiles?.stripe_account_id
  if (!payment?.stripe_payment_intent_id || !teacherAccountId) {
    return NextResponse.json({ error: 'Payment record is missing for this booking' }, { status: 500 })
  }

  const studentProfile = (booking as any).profiles
  const teacherName = (booking as any).teacher_profiles?.profiles?.full_name || 'your teacher'
  const meetingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/session/${booking.id}`
  const calendarUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/bookings/${booking.id}/calendar`

  try {
    if (action === 'approve') {
      await captureBookingPayment(payment.stripe_payment_intent_id, teacherAccountId)
      await supabase.from('bookings').update({ status: 'confirmed' } as any).eq('id', booking.id)
      await supabase.from('payments').update({ status: 'succeeded' } as any).eq('id', payment.id)

      if (studentProfile?.email) {
        await sendBookingApprovedEmail({
          to: studentProfile.email,
          studentName: studentProfile.full_name || 'there',
          teacherName,
          subject: booking.subject,
          startAt: booking.start_at,
          meetingUrl,
          calendarUrl,
        })
      }
    } else {
      await cancelBookingPayment(payment.stripe_payment_intent_id, teacherAccountId)
      await supabase.from('bookings').update({ status: 'rejected' } as any).eq('id', booking.id)
      await supabase.from('payments').update({ status: 'cancelled' } as any).eq('id', payment.id)

      if (studentProfile?.email) {
        await sendBookingRejectedEmail({
          to: studentProfile.email,
          studentName: studentProfile.full_name || 'there',
          teacherName,
          subject: booking.subject,
          startAt: booking.start_at,
          reason: 'declined',
        })
      }
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unable to process this response' }, { status: 502 })
  }

  return NextResponse.json({ status: action === 'approve' ? 'confirmed' : 'rejected' })
}
