import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateBookingICS } from '@/lib/ics'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, teacher_profiles(id, profiles(full_name)), profiles!student_id(full_name)')
    .eq('id', params.id)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  const isParticipant = booking.student_id === userId || booking.teacher_id === userId
  const isAdmin = (profile as { role?: string } | null)?.role === 'admin'
  if (!isParticipant && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ics = generateBookingICS({
    bookingId: booking.id,
    subject: booking.subject,
    startAt: booking.start_at,
    endAt: booking.end_at,
    teacherName: (booking as any).teacher_profiles?.profiles?.full_name || 'Teacher',
    studentName: (booking as any).profiles?.full_name || 'Student',
    meetingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/session/${booking.id}`,
  })

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="lesson-${booking.id}.ics"`,
    },
  })
}
