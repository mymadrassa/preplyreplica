import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM || 'Preply Clone <onboarding@resend.dev>'

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
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping reminder email to', to)
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const startsAt = new Date(startAt).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Reminder: your ${subject} lesson starts in about an hour`,
    html: `
      <p>Hi ${recipientName},</p>
      <p>Your <strong>${subject}</strong> lesson with ${otherPartyName} starts at <strong>${startsAt}</strong>.</p>
      <p><a href="${meetingUrl}">Join the lesson</a></p>
      <p><a href="${calendarUrl}">Add to calendar</a></p>
    `,
  })
}
