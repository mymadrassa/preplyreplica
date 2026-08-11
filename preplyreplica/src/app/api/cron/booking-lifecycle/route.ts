import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { cancelBookingPayment } from '@/lib/stripe'
import { sendBookingRejectedEmail } from '@/lib/email'

// Session completion no longer auto-fires from here — that now requires
// the teacher to mark a session done AND an admin to confirm it (see
// /api/bookings/[id]/complete and /api/admin/bookings/[id]/confirm-
// completion) before a payout releases. This cron only cleans up bookings
// that never got a human response:
const ABANDONED_HOLD_MINUTES = 30
const APPROVAL_TIMEOUT_HOURS = 24

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const results: Array<{ bookingId: string; action: string; error?: string }> = []

  // Checkout was started (slot held) but never completed — nothing was
  // ever authorized, so there's no Stripe hold to release, just free the
  // slot in our own data.
  const abandonedCutoff = new Date(Date.now() - ABANDONED_HOLD_MINUTES * 60 * 1000).toISOString()
  const { data: abandoned } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'pending_payment')
    .lt('created_at', abandonedCutoff)

  for (const booking of abandoned ?? []) {
    await supabase.from('bookings').update({ status: 'cancelled' } as any).eq('id', booking.id)
    results.push({ bookingId: booking.id, action: 'expired_hold' })
  }

  // Payment was authorized (student paid) but the teacher never responded
  // — release the hold, no charge, and let the student know.
  const timeoutCutoff = new Date(Date.now() - APPROVAL_TIMEOUT_HOURS * 60 * 60 * 1000).toISOString()
  const { data: unanswered } = await supabase
    .from('bookings')
    .select('*, teacher_profiles(stripe_account_id, profiles(full_name)), profiles!student_id(full_name, email)')
    .eq('status', 'pending')
    .lt('created_at', timeoutCutoff)

  for (const booking of unanswered ?? []) {
    const { data: payment } = await supabase.from('payments').select('*').eq('booking_id', booking.id).single()
    const teacherAccountId = (booking as any).teacher_profiles?.stripe_account_id

    if (!payment?.stripe_payment_intent_id || !teacherAccountId) {
      results.push({ bookingId: booking.id, action: 'skipped', error: 'Missing payment or Stripe account' })
      continue
    }

    try {
      await cancelBookingPayment(payment.stripe_payment_intent_id, teacherAccountId)
      await supabase.from('bookings').update({ status: 'rejected' } as any).eq('id', booking.id)
      await supabase.from('payments').update({ status: 'cancelled' } as any).eq('id', payment.id)

      const studentProfile = (booking as any).profiles
      if (studentProfile?.email) {
        await sendBookingRejectedEmail({
          to: studentProfile.email,
          studentName: studentProfile.full_name || 'there',
          teacherName: (booking as any).teacher_profiles?.profiles?.full_name || 'The teacher',
          subject: booking.subject,
          startAt: booking.start_at,
          reason: 'timed_out',
        })
      }
      results.push({ bookingId: booking.id, action: 'auto_rejected' })
    } catch (err: any) {
      results.push({ bookingId: booking.id, action: 'reject_failed', error: err?.message })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
