import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { sendBookingReminderEmail } from '@/lib/email'

const REMINDER_LEAD_MINUTES = 60

// Sends a "starts in ~1h" reminder email to both student and teacher, once
// per booking. Called every 15 minutes by Vercel Cron (see vercel.json).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60 * 1000)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, teacher_profiles(profiles(full_name, email)), profiles!student_id(full_name, email)')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('start_at', now.toISOString())
    .lte('start_at', windowEnd.toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: Array<{ bookingId: string; status: string }> = []

  for (const booking of bookings ?? []) {
    const teacherProfile = (booking as any).teacher_profiles?.profiles
    const studentProfile = (booking as any).profiles
    const meetingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/session/${booking.id}`
    const calendarUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/bookings/${booking.id}/calendar`

    try {
      if (studentProfile?.email) {
        await sendBookingReminderEmail({
          to: studentProfile.email,
          recipientName: studentProfile.full_name || 'there',
          otherPartyName: teacherProfile?.full_name || 'your teacher',
          subject: booking.subject,
          startAt: booking.start_at,
          meetingUrl,
          calendarUrl,
        })
      }
      if (teacherProfile?.email) {
        await sendBookingReminderEmail({
          to: teacherProfile.email,
          recipientName: teacherProfile.full_name || 'there',
          otherPartyName: studentProfile?.full_name || 'your student',
          subject: booking.subject,
          startAt: booking.start_at,
          meetingUrl,
          calendarUrl,
        })
      }

      await supabase.from('bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', booking.id)
      results.push({ bookingId: booking.id, status: 'sent' })
    } catch (err: any) {
      results.push({ bookingId: booking.id, status: `failed: ${err?.message}` })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
