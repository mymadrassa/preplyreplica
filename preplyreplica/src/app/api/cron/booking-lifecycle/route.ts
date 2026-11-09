import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { paymentRefFor } from '@/lib/payments'
import { closePackageWithRefund, returnPackageLesson } from '@/lib/packages'
import { loadAdmins, settleEndedLessons } from '@/lib/lessonPayouts'
import { appUrl } from '@/lib/appUrl'
import { sendBookingRejectedEmail, sendOpenReportsReminderEmail } from '@/lib/email'

// Daily housekeeping. Nobody has to confirm a lesson took place: once it
// ends it counts as given, and unless the student or the teacher reports a
// problem within 48 hours it's paid: a trial on its own, other lessons in
// the monthly payout on the 3rd (see /api/cron/monthly-payouts). This cron
// also cleans up bookings that never got a response:
const ABANDONED_HOLD_MINUTES = 30
const APPROVAL_TIMEOUT_HOURS = 24
// Open reports keep a lesson's payout on hold; admins are reminded after a week.
const REPORT_REMINDER_DAYS = 7

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const results: Array<{ bookingId: string; action: string; error?: string }> = []

  // Checkout was started (slot held) but never completed — nothing was
  // ever authorized, so there's no payment hold to release, just free the
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
    .select('*, teacher_profiles(payout_account_id, profiles(full_name)), profiles!student_id(full_name, email)')
    .eq('status', 'pending')
    .lt('created_at', timeoutCutoff)

  for (const booking of unanswered ?? []) {
    // A package lesson has no payment of its own: the lesson goes back to the package.
    const packageId = booking.package_id
    const { data: payment } = packageId ? { data: null } : await supabase.from('payments').select('*').eq('booking_id', booking.id).single()
    const charge = paymentRefFor(payment, (booking as any).teacher_profiles)

    if (!packageId && (!payment || !charge)) {
      results.push({ bookingId: booking.id, action: 'skipped', error: 'Missing payment or payout account' })
      continue
    }

    try {
      if (charge) await charge.provider.cancelPayment(charge.ref)
      await supabase.from('bookings').update({ status: 'rejected' } as any).eq('id', booking.id)
      if (payment) await supabase.from('payments').update({ status: 'cancelled' } as any).eq('id', payment.id)
      if (packageId) await returnPackageLesson(packageId)

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

  // Ended lessons count as given; 48 hours later, unreported ones become
  // payable (see /api/cron/monthly-payouts).
  const settled = await settleEndedLessons()
  results.push({ bookingId: '-', action: `settled: ${settled.completed} completed, ${settled.scheduled} payable` })

  // Reports waiting more than a week: remind the admins (once per report).
  const reminderCutoff = new Date(Date.now() - REPORT_REMINDER_DAYS * 86_400_000).toISOString()
  const { data: stale } = await supabase.from('lesson_reports').select('id').eq('status', 'open').is('reminder_sent_at', null).lt('created_at', reminderCutoff)
  if (stale?.length) {
    const admins = await loadAdmins()
    await sendOpenReportsReminderEmail({ to: admins.emails, count: stale.length, reviewUrl: appUrl('/admin/reports') })
    await supabase.from('lesson_reports').update({ reminder_sent_at: new Date().toISOString() }).in('id', stale.map((r) => r.id))
  }

  // Packages past their validity: unused lessons are refunded at the discounted price.
  const { data: expired } = await supabase.from('lesson_packages').select('*').eq('status', 'active').lt('expires_at', new Date().toISOString())
  for (const pkg of expired ?? []) {
    const result = await closePackageWithRefund(pkg, 'expired')
    results.push({ bookingId: pkg.id, action: 'error' in result ? 'package_refund_failed' : 'package_expired', error: 'error' in result ? result.error : undefined })
  }

  return NextResponse.json({ processed: results.length, results })
}
