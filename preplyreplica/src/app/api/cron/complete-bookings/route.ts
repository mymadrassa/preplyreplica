import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { payoutToTeacherAccount } from '@/lib/stripe'

const COMPLETION_GRACE_HOURS = 24

// Auto-completes bookings whose session ended more than 24h ago (giving
// students a window to report a no-show/issue before the teacher is paid
// out), then releases that booking's payout from the teacher's Stripe
// balance to their bank account. Called once daily by Vercel Cron (see
// vercel.json — the Hobby plan doesn't allow more frequent schedules),
// which sends a GET request with an `Authorization: Bearer $CRON_SECRET`
// header automatically attached.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const cutoff = new Date(Date.now() - COMPLETION_GRACE_HOURS * 60 * 60 * 1000).toISOString()

  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('*, teacher_profiles(stripe_account_id)')
    .eq('status', 'confirmed')
    .lt('end_at', cutoff)

  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 })
  }

  const results: Array<{ bookingId: string; status: string; error?: string }> = []

  for (const booking of bookings ?? []) {
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', booking.id)
      .eq('status', 'succeeded')
      .is('payout_at', null)
      .single()

    const teacherAccountId = (booking as any).teacher_profiles?.stripe_account_id

    if (!payment || !teacherAccountId) {
      results.push({ bookingId: booking.id, status: 'skipped', error: 'No succeeded, unpaid-out payment found' })
      continue
    }

    try {
      await payoutToTeacherAccount(teacherAccountId, payment.teacher_fee)
      await supabase.from('payments').update({ payout_at: new Date().toISOString() }).eq('id', payment.id)
      await supabase.from('bookings').update({ status: 'completed' }).eq('id', booking.id)
      results.push({ bookingId: booking.id, status: 'completed' })
    } catch (err: any) {
      results.push({ bookingId: booking.id, status: 'payout_failed', error: err?.message })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
