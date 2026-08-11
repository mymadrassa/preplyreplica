import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM || 'Preply Clone <onboarding@resend.dev>'

async function sendEmail(to: string | string[], subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email to', to)
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({ from: FROM, to, subject, html })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })
}

export async function sendBookingReminderEmail({
  to,
  recipientName,
  otherPartyName,
  subject,
  startAt,
  meetingUrl,
  calendarUrl,
}: {
  to: string
  recipientName: string
  otherPartyName: string
  subject: string
  startAt: string
  meetingUrl: string
  calendarUrl: string
}) {
  await sendEmail(
    to,
    `Reminder: your ${subject} lesson starts in about an hour`,
    `
      <p>Hi ${recipientName},</p>
      <p>Your <strong>${subject}</strong> lesson with ${otherPartyName} starts at <strong>${formatDateTime(startAt)}</strong>.</p>
      <p><a href="${meetingUrl}">Join the lesson</a></p>
      <p><a href="${calendarUrl}">Add to calendar</a></p>
    `
  )
}

/** Sent to the teacher the moment a student's payment is authorized — the booking is now waiting on their approval. */
export async function sendNewBookingRequestEmail({
  to,
  teacherName,
  studentName,
  subject,
  startAt,
  dashboardUrl,
}: {
  to: string
  teacherName: string
  studentName: string
  subject: string
  startAt: string
  dashboardUrl: string
}) {
  await sendEmail(
    to,
    `New booking request: ${subject} with ${studentName}`,
    `
      <p>Hi ${teacherName},</p>
      <p><strong>${studentName}</strong> wants to book a <strong>${subject}</strong> lesson with you at <strong>${formatDateTime(startAt)}</strong>.</p>
      <p>Their payment is authorized and on hold — nothing is charged until you approve. If you don't respond within 24 hours, the request is automatically declined and released.</p>
      <p><a href="${dashboardUrl}">Review this request</a></p>
    `
  )
}

/** Sent to the student once the teacher approves — payment is captured and the booking is locked in. */
export async function sendBookingApprovedEmail({
  to,
  studentName,
  teacherName,
  subject,
  startAt,
  meetingUrl,
  calendarUrl,
}: {
  to: string
  studentName: string
  teacherName: string
  subject: string
  startAt: string
  meetingUrl: string
  calendarUrl: string
}) {
  await sendEmail(
    to,
    `Booking confirmed: ${subject} with ${teacherName}`,
    `
      <p>Hi ${studentName},</p>
      <p>${teacherName} approved your <strong>${subject}</strong> lesson at <strong>${formatDateTime(startAt)}</strong>. Your card has been charged.</p>
      <p><a href="${meetingUrl}">Lesson details</a></p>
      <p><a href="${calendarUrl}">Add to calendar</a></p>
    `
  )
}

/** Sent to the student when the teacher declines, or the request times out unanswered after 24h. */
export async function sendBookingRejectedEmail({
  to,
  studentName,
  teacherName,
  subject,
  startAt,
  reason,
}: {
  to: string
  studentName: string
  teacherName: string
  subject: string
  startAt: string
  reason: 'declined' | 'timed_out'
}) {
  const explanation =
    reason === 'declined'
      ? `${teacherName} wasn't able to accept this request.`
      : `${teacherName} didn't respond to this request within 24 hours.`

  await sendEmail(
    to,
    `Booking request not confirmed: ${subject} with ${teacherName}`,
    `
      <p>Hi ${studentName},</p>
      <p>Your request for a <strong>${subject}</strong> lesson at <strong>${formatDateTime(startAt)}</strong> was not confirmed. ${explanation}</p>
      <p>No charge was made — the authorization on your card has been released.</p>
    `
  )
}

/** Sent to the teacher when a student cancels a confirmed booking (still outside the 12h cancellation window). */
export async function sendBookingCancelledEmail({
  to,
  teacherName,
  studentName,
  subject,
  startAt,
}: {
  to: string
  teacherName: string
  studentName: string
  subject: string
  startAt: string
}) {
  await sendEmail(
    to,
    `Booking cancelled: ${subject} with ${studentName}`,
    `
      <p>Hi ${teacherName},</p>
      <p>${studentName} cancelled the <strong>${subject}</strong> lesson scheduled for <strong>${formatDateTime(startAt)}</strong>. They've been refunded, and that time is open again on your calendar.</p>
    `
  )
}

/** Sent to admins once a teacher marks a session complete — payout is on hold until an admin also confirms. */
export async function sendAwaitingAdminReviewEmail({
  to,
  teacherName,
  studentName,
  subject,
  startAt,
  reviewUrl,
}: {
  to: string[]
  teacherName: string
  studentName: string
  subject: string
  startAt: string
  reviewUrl: string
}) {
  if (!to.length) return
  await sendEmail(
    to,
    `Payout awaiting review: ${subject} (${teacherName})`,
    `
      <p>${teacherName} marked their <strong>${subject}</strong> lesson with ${studentName} (${formatDateTime(startAt)}) as complete.</p>
      <p>The teacher's payout is on hold until an admin confirms the session took place.</p>
      <p><a href="${reviewUrl}">Review and confirm</a></p>
    `
  )
}
