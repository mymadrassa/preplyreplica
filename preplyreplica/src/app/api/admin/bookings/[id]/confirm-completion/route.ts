import { NextResponse } from 'next/server'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { getPaymentProvider } from '@/lib/payments'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  // Bookings and payments are written only by the server (see migration 0036), after the checks below.
  const db = createSupabaseServiceRoleClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, teacher_profiles(payout_account_id, payment_provider)')
    .eq('id', params.id)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: `This booking is ${booking.status}, not confirmed.` }, { status: 409 })
  }
  if (!booking.teacher_confirmed_at) {
    return NextResponse.json({ error: "The teacher hasn't marked this session as complete yet." }, { status: 409 })
  }
  if (booking.admin_confirmed_at) {
    return NextResponse.json({ error: 'This session was already confirmed.' }, { status: 409 })
  }

  // What the teacher is owed for this lesson: its own payment, or one lesson's
  // share of the package it was taken from (already in their payout balance).
  const [{ data: payment }, { data: pkg }] = await Promise.all([
    booking.package_id
      ? Promise.resolve({ data: null })
      : supabase.from('payments').select('*').eq('booking_id', booking.id).eq('status', 'succeeded').is('payout_at', null).single(),
    booking.package_id ? supabase.from('lesson_packages').select('teacher_fee_per_lesson, provider').eq('id', booking.package_id).single() : Promise.resolve({ data: null }),
  ])

  const teacher = (booking as any).teacher_profiles as { payout_account_id: string | null; payment_provider: string } | null
  const teacherAccountId = teacher?.payout_account_id
  const owed = payment ? { amount: payment.teacher_fee, provider: payment.provider } : pkg ? { amount: pkg.teacher_fee_per_lesson, provider: pkg.provider } : null
  if (!owed || !teacherAccountId) {
    return NextResponse.json({ error: 'No payable payment found for this booking' }, { status: 500 })
  }

  try {
    await getPaymentProvider(owed.provider).payout({ payeeAccountId: teacherAccountId, amount: owed.amount, currency: 'gbp' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Payout failed' }, { status: 502 })
  }

  if (payment) await db.from('payments').update({ payout_at: new Date().toISOString() } as any).eq('id', payment.id)
  await db
    .from('bookings')
    .update({ admin_confirmed_at: new Date().toISOString(), status: 'completed' } as any)
    .eq('id', booking.id)

  return NextResponse.json({ status: 'completed' })
}
