import nodemailer, { type Transporter } from 'nodemailer'

// Every email the app sends goes through the IONOS mailbox (SMTP), the same
// one Supabase uses for signup confirmations:
//   SMTP_HOST=smtp.ionos.co.uk  SMTP_PORT=465
//   SMTP_USER=support@mymadrassa.com  SMTP_PASSWORD=…
//   EMAIL_FROM="My Madrassa <support@mymadrassa.com>"
const FROM = process.env.EMAIL_FROM || `My Madrassa <${process.env.SMTP_USER}>`

let transporter: Transporter | null = null
function smtp(): Transporter {
  const port = Number(process.env.SMTP_PORT || 465)
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ionos.co.uk',
    port,
    // 465 is TLS from the start; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  })
  return transporter
}

async function sendEmail(to: string | string[], subject: string, html: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn('SMTP_USER / SMTP_PASSWORD not set — skipping email to', to)
    return
  }
  await smtp().sendMail({ from: FROM, to, subject, html })
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

/** Sent to the student when an admin doesn't confirm a completed session within the review window — refunded automatically instead of paying the teacher out. */
export async function sendPayoutReviewTimedOutStudentEmail({
  to,
  studentName,
  teacherName,
  subject,
  startAt,
}: {
  to: string
  studentName: string
  teacherName: string
  subject: string
  startAt: string
}) {
  await sendEmail(
    to,
    `You've been refunded: ${subject} with ${teacherName}`,
    `
      <p>Hi ${studentName},</p>
      <p>Your <strong>${subject}</strong> lesson with ${teacherName} on <strong>${formatDateTime(startAt)}</strong> wasn't reviewed by our team in time, so you've been fully refunded.</p>
    `
  )
}

/** Sent to the teacher in the same situation — explains why no payout occurred despite them marking the session complete. */
export async function sendPayoutReviewTimedOutTeacherEmail({
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
    `Payout not released: ${subject} with ${studentName}`,
    `
      <p>Hi ${teacherName},</p>
      <p>Our team didn't confirm your <strong>${subject}</strong> lesson with ${studentName} on <strong>${formatDateTime(startAt)}</strong> in time, so no payout was released and the student has been refunded. We're sorry for the inconvenience — please reach out if you believe this was in error.</p>
    `
  )
}

/** Sent to the teacher the moment an admin approves their profile — the one email tied to the approval-timeline's "admin review" step going green. */
export async function sendTeacherApprovedEmail({
  to,
  teacherName,
  dashboardUrl,
}: {
  to: string
  teacherName: string
  dashboardUrl: string
}) {
  await sendEmail(
    to,
    `You're approved! Your profile is now live`,
    `
      <p>Hi ${teacherName},</p>
      <p>Congratulations — your profile has been approved and is now visible to students.</p>
      <p><a href="${dashboardUrl}">Go to your dashboard</a></p>
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

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** The cahier de texte entry for one lesson, sent by email (directly, or when WhatsApp can't reach the student). */
export async function sendHomeworkEmail({
  to,
  studentName,
  teacherName,
  lessonDate,
  revision,
  memorization,
  note,
  homeworkUrl,
  updated,
}: {
  to: string
  studentName: string
  teacherName: string
  lessonDate: string
  revision: string
  memorization: string
  note: string
  homeworkUrl: string
  updated: boolean
}) {
  await sendEmail(
    to,
    `${updated ? 'Updated homework' : 'Your homework'} from ${teacherName}`,
    `
      <p>Assalamu alaykum ${escapeHtml(studentName)},</p>
      <p>${updated ? 'Your homework has been updated' : 'Here is your homework'} from your lesson with ${escapeHtml(teacherName)} on <strong>${escapeHtml(lessonDate)}</strong>.</p>
      <p><strong>Revision:</strong> ${escapeHtml(revision)}<br/><strong>New memorisation:</strong> ${escapeHtml(memorization)}</p>
      ${note && note !== '—' ? `<p><strong>Note from your teacher:</strong> ${escapeHtml(note)}</p>` : ''}
      <p><a href="${homeworkUrl}">Open your cahier de texte</a></p>
    `
  )
}

/** A 10-lesson package was paid: to the student (how to book) and to the teacher (who bought it). */
export async function sendPackagePurchasedEmails({
  student,
  teacher,
  lessons,
  price,
  expiresAt,
  bookUrl,
}: {
  student: { email: string | null; name: string }
  teacher: { email: string | null; name: string }
  lessons: number
  /** Pounds. */
  price: number
  expiresAt: string
  bookUrl: string
}) {
  const until = new Date(expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' })
  if (student.email) {
    await sendEmail(
      student.email,
      `Your ${lessons}-lesson package with ${teacher.name}`,
      `
        <p>Assalamu alaykum ${escapeHtml(student.name)},</p>
        <p>Your package of <strong>${lessons} lessons</strong> with ${escapeHtml(teacher.name)} is ready (£${price.toFixed(2)}). Use your lessons by <strong>${until}</strong>; any you haven't used by then are refunded automatically.</p>
        <p><a href="${bookUrl}">Book your next lesson</a></p>
      `
    )
  }
  if (teacher.email) {
    await sendEmail(
      teacher.email,
      `${student.name} bought ${lessons} lessons with you`,
      `
        <p>Hi ${escapeHtml(teacher.name)},</p>
        <p>${escapeHtml(student.name)} bought a package of <strong>${lessons} lessons</strong> with you. You're paid for each lesson once it's completed.</p>
      `
    )
  }
}

/** Unused package lessons were refunded (the student cancelled, or the package expired). */
export async function sendPackageRefundedEmail({ to, studentName, teacherName, lessons, amount, reason }: { to: string; studentName: string; teacherName: string; lessons: number; amount: number; reason: 'cancelled' | 'expired' }) {
  await sendEmail(
    to,
    `Refund for ${lessons} unused lesson${lessons === 1 ? '' : 's'}`,
    `
      <p>Assalamu alaykum ${escapeHtml(studentName)},</p>
      <p>${reason === 'expired' ? 'Your package' : 'You cancelled your package'} with ${escapeHtml(teacherName)}${reason === 'expired' ? ' has expired' : ''}. We've refunded <strong>£${amount.toFixed(2)}</strong> for ${lessons} unused lesson${lessons === 1 ? '' : 's'}. It can take a few days to reach your card.</p>
    `
  )
}

/** The daily tier review promoted a teacher. */
export async function sendTierPromotionEmail({ to, teacherName, tierLabel, commissionPercent }: { to: string; teacherName: string; tierLabel: string; commissionPercent: number }) {
  await sendEmail(
    to,
    `You've reached ${tierLabel}!`,
    `
      <p>Congratulations ${escapeHtml(teacherName)},</p>
      <p>You've reached the <strong>${tierLabel}</strong> tier. Our commission on your lessons is now <strong>${commissionPercent}%</strong>, so students pay less for your lessons while you still receive your full rate.</p>
    `
  )
}

/** The password reset link, sent by the app itself (see /api/auth/forgot-password). */
export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }) {
  await sendEmail(
    to,
    'Reset your password',
    `
      <p>Assalamu alaykum,</p>
      <p>We received a request to reset the password for your account. Click the button below to choose a new one. The link works once and expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Choose a new password</a></p>
      <p style="color:#64748b;font-size:13px">If you didn't ask for this, you can ignore this email: your password stays the same.</p>
    `
  )
}
