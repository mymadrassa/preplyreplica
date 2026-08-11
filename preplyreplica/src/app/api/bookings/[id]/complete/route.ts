import { NextResponse } from 'next/server'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { sendAwaitingAdminReviewEmail } from '@/lib/email'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, teacher_profiles(profiles(full_name)), profiles!student_id(full_name, email)')
    .eq('id', params.id)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  if (booking.teacher_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: `This booking is ${booking.status}, not confirmed.` }, { status: 409 })
  }
  if (new Date(booking.end_at) > new Date()) {
    return NextResponse.json({ error: "This session hasn't ended yet." }, { status: 409 })
  }
  if (booking.teacher_confirmed_at) {
    return NextResponse.json({ error: 'You already marked this session as complete.' }, { status: 409 })
  }

  await supabase.from('bookings').update({ teacher_confirmed_at: new Date().toISOString() } as any).eq('id', booking.id)

  // Admin recipients aren't gated behind the user's own session, so look
  // them up with the service-role client rather than the RLS-scoped one.
  const service = createSupabaseServiceRoleClient()
  const { data: admins } = await service.from('profiles').select('email').eq('role', 'admin')
  const adminEmails = (admins || []).map((admin) => admin.email).filter((email): email is string => Boolean(email))

  await sendAwaitingAdminReviewEmail({
    to: adminEmails,
    teacherName: (booking as any).teacher_profiles?.profiles?.full_name || 'A teacher',
    studentName: (booking as any).profiles?.full_name || (booking as any).profiles?.email || 'a student',
    subject: booking.subject,
    startAt: booking.start_at,
    reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/dashboard`,
  })

  return NextResponse.json({ teacherConfirmedAt: new Date().toISOString() })
}
