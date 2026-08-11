import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { payoutToTeacherAccount } from '@/lib/stripe'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
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
    .select('*, teacher_profiles(stripe_account_id)')
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

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('status', 'succeeded')
    .is('payout_at', null)
    .single()

  const teacherAccountId = (booking as any).teacher_profiles?.stripe_account_id
  if (!payment || !teacherAccountId) {
    return NextResponse.json({ error: 'No payable payment found for this booking' }, { status: 500 })
  }

  try {
    await payoutToTeacherAccount(teacherAccountId, payment.teacher_fee)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Payout failed' }, { status: 502 })
  }

  await supabase.from('payments').update({ payout_at: new Date().toISOString() } as any).eq('id', payment.id)
  await supabase
    .from('bookings')
    .update({ admin_confirmed_at: new Date().toISOString(), status: 'completed' } as any)
    .eq('id', booking.id)

  return NextResponse.json({ status: 'completed' })
}
