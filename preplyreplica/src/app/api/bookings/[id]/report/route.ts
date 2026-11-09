import { NextResponse } from 'next/server'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { canReport, reportReasonLabel, reportSchema, type FeedbackRole } from '@/lib/sessionFeedback'
import { loadParticipants } from '@/lib/participantNames'
import { loadAdmins } from '@/lib/lessonPayouts'
import { sendAdminMessage } from '@/lib/support'
import { sendLessonReportedEmail } from '@/lib/email'
import { formatBookingDateTime } from '@/lib/format'
import { appUrl } from '@/lib/appUrl'

/**
 * Reports a problem with a lesson (absence, platform technical problem, cut
 * short, other), up to 48 hours after its end. The lesson's payout is held
 * until an admin resolves the report; the admins are emailed, and both sides
 * get a note in their Admin conversation.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: booking } = await supabase.from('bookings').select('id, student_id, teacher_id, subject, start_at, end_at, status, payout_state').eq('id', params.id).maybeSingle()
  const role: FeedbackRole | null = booking?.student_id === userId ? 'student' : booking?.teacher_id === userId ? 'teacher' : null
  if (!booking || !role) {
    return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 })
  }
  if (!canReport(booking) || booking.payout_state === 'paid' || booking.payout_state === 'refunded') {
    return NextResponse.json({ error: 'Problems can be reported from the start of the lesson until 48 hours after it ends.' }, { status: 409 })
  }

  const parsed = reportSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid report.' }, { status: 400 })
  }
  const { reason, detail } = parsed.data

  const db = createSupabaseServiceRoleClient()
  const { error: reportError } = await db.from('lesson_reports').insert({ booking_id: booking.id, reported_by: userId, reporter_role: role, reason, detail })
  if (reportError?.code === '23505') {
    return NextResponse.json({ error: 'You already reported this lesson. Our team will get back to you.' }, { status: 409 })
  }
  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 })

  await db.from('bookings').update({ payout_state: 'held' }).eq('id', booking.id)

  // The report answers the post-lesson popup too, unless feedback was already given.
  const otherId = role === 'student' ? booking.teacher_id : booking.student_id
  const { data: feedback } = await db.from('session_feedback').select('status').eq('booking_id', booking.id).eq('author_id', userId).maybeSingle()
  if (feedback?.status !== 'given') {
    await db.from('session_feedback').upsert(
      { booking_id: booking.id, author_id: userId, recipient_id: otherId, author_role: role, status: 'given', outcome: 'reported', report_reason: reason, report_detail: detail, rating: null, comment: null, visibility: null, tags: [] },
      { onConflict: 'booking_id,author_id' }
    )
  }

  const [people, admins] = await Promise.all([loadParticipants([userId, otherId]), loadAdmins()])
  const reporterName = people.get(userId)?.name ?? (role === 'student' ? 'The student' : 'The teacher')
  const otherName = people.get(otherId)?.name ?? (role === 'student' ? 'the teacher' : 'the student')
  const reasonLabel = reportReasonLabel(reason, role)
  const when = formatBookingDateTime(booking.start_at)

  await Promise.all([
    sendLessonReportedEmail({
      to: admins.emails,
      reporterName,
      reporterRole: role,
      otherName,
      subject: booking.subject,
      startAt: booking.start_at,
      reason: reasonLabel,
      detail,
      reviewUrl: appUrl(`/admin/reports/${booking.id}`),
    }).catch((error) => console.error('[report] admin email failed', error)),
    admins.senderId
      ? sendAdminMessage(
          userId,
          admins.senderId,
          `We've received your report about your ${booking.subject} lesson with ${otherName} (${when}): "${reasonLabel}". Our team will look into it and get back to you here${role === 'teacher' ? '; the payment for this lesson is on hold until then' : ''}. You can add anything useful by replying to this message.`
        )
      : null,
    admins.senderId
      ? sendAdminMessage(
          otherId,
          admins.senderId,
          `${reporterName} reported a problem with your ${booking.subject} lesson (${when}): "${reasonLabel}". Our team is looking into it${role === 'student' ? ' and the payment for this lesson is on hold until then' : ''}. Please reply here with your side of what happened.`
        )
      : null,
  ])

  return NextResponse.json({ status: 'reported' })
}
