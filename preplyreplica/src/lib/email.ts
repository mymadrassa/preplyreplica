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
  receiptUrl,
}: {
  student: { email: string | null; name: string }
  teacher: { email: string | null; name: string }
  lessons: number
  /** Pounds. */
  price: number
  expiresAt: string
  bookUrl: string
  receiptUrl: string
}) {
  const until = new Date(expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' })
  if (student.email) {
    await sendEmail(
      student.email,
      `Your ${lessons}-lesson package with ${teacher.name}`,
      `
        <p>Assalamu alaykum ${escapeHtml(student.name)},</p>
        <p>Your package of <strong>${lessons} lessons</strong> with ${escapeHtml(teacher.name)} is ready (£${price.toFixed(2)}). Use your lessons by <strong>${until}</strong>; any you haven't used by then are refunded automatically.</p>
        <p><a href="${bookUrl}">Book your next lesson</a> · <a href="${receiptUrl}">Your receipt</a></p>
      `
    )
  }
  if (teacher.email) {
    await sendEmail(
      teacher.email,
      `${student.name} bought ${lessons} lessons with you`,
      `
        <p>Hi ${escapeHtml(teacher.name)},</p>
        <p>${escapeHtml(student.name)} bought a package of <strong>${lessons} lessons</strong> with you. You're paid your full rate for each lesson you give, with your monthly payout on the 3rd.</p>
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
export async function sendTierPromotionEmail({ to, teacherName, tierLabel, rate }: { to: string; teacherName: string; tierLabel: string; rate: number }) {
  await sendEmail(
    to,
    `You've reached ${tierLabel}!`,
    `
      <p>Congratulations ${escapeHtml(teacherName)},</p>
      <p>You've reached the <strong>${tierLabel}</strong> tier: your rate is now <strong>£${rate.toFixed(2)} per hour</strong>. It applies to new packages your students buy; packages already bought keep their price.</p>
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

/** The admin didn't approve the teacher's profile: what to fix, then resubmit. */
export async function sendTeacherNotApprovedEmail({ to, teacherName, message, profileUrl }: { to: string; teacherName: string; message: string; profileUrl: string }) {
  await sendEmail(
    to,
    'Your teacher profile needs a few changes',
    `
      <p>Assalamu alaykum ${escapeHtml(teacherName)},</p>
      <p>Thank you for submitting your profile. Our team reviewed it and it can't be approved yet:</p>
      <div style="white-space:pre-line;border-left:3px solid #f59e0b;padding:8px 12px;background:#fffbeb">${escapeHtml(message)}</div>
      <p>Once it's done, submit your profile again from your Profile page.</p>
      <p><a href="${profileUrl}">Open my profile</a></p>
    `
  )
}

/** A lesson was reported: its payout is held until an admin resolves it. */
export async function sendLessonReportedEmail({ to, reporterName, reporterRole, otherName, subject, startAt, reason, detail, reviewUrl }: { to: string[]; reporterName: string; reporterRole: 'student' | 'teacher'; otherName: string; subject: string; startAt: string; reason: string; detail: string; reviewUrl: string }) {
  if (!to.length) return
  await sendEmail(
    to,
    `Lesson reported: ${reason}`,
    `
      <p>${escapeHtml(reporterName)} (${reporterRole}) reported a problem with the <strong>${escapeHtml(subject)}</strong> lesson with ${escapeHtml(otherName)} on ${formatDateTime(startAt)}.</p>
      <p><strong>${escapeHtml(reason)}</strong></p>
      <blockquote style="border-left:3px solid #cbd5e1;margin:0;padding-left:12px;color:#334155">${escapeHtml(detail).replace(/\n/g, '<br>')}</blockquote>
      <p>The teacher's payout for this lesson is on hold until you decide.</p>
      <p><a href="${reviewUrl}">Review the report</a></p>
    `
  )
}

/** Reports still open after a week: the lessons' payouts are still on hold. */
export async function sendOpenReportsReminderEmail({ to, count, reviewUrl }: { to: string[]; count: number; reviewUrl: string }) {
  if (!to.length || !count) return
  await sendEmail(
    to,
    `${count} lesson report${count === 1 ? '' : 's'} waiting for more than a week`,
    `
      <p>${count} reported lesson${count === 1 ? ' is' : 's are'} still waiting for a decision. Their teachers' payouts stay on hold until then.</p>
      <p><a href="${reviewUrl}">Review the reports</a></p>
    `
  )
}

/** The monthly payout went out. */
export async function sendMonthlyPayoutEmail({ to, teacherName, periodLabel, lessons, amount, earningsUrl, statementUrl }: { to: string; teacherName: string; periodLabel: string; lessons: number; amount: number; earningsUrl: string; statementUrl: string }) {
  await sendEmail(
    to,
    `Your earnings for ${periodLabel}: £${amount.toFixed(2)}`,
    `
      <p>Assalamu alaykum ${escapeHtml(teacherName)},</p>
      <p>We've sent <strong>£${amount.toFixed(2)}</strong> to your bank account for ${lessons} lesson${lessons === 1 ? '' : 's'} (${periodLabel}). It usually arrives within a few working days.</p>
      <p><a href="${statementUrl}">Your statement</a> (every lesson, with each fee) · <a href="${earningsUrl}">Earnings</a></p>
    `
  )
}

/** The monthly payout couldn't be sent; it's retried every day. */
export async function sendPayoutFailedEmail({ to, teacherName, periodLabel, amount, reason, earningsUrl }: { to: string | string[]; teacherName: string; periodLabel: string; amount: number; reason: string; earningsUrl: string }) {
  await sendEmail(
    to,
    `Payout for ${periodLabel} couldn't be sent`,
    `
      <p>The payout of <strong>£${amount.toFixed(2)}</strong> to ${escapeHtml(teacherName)} for ${periodLabel} couldn't be sent:</p>
      <p style="color:#b91c1c">${escapeHtml(reason)}</p>
      <p>We'll try again every day. If your bank details need updating, please check your payout account.</p>
      <p><a href="${earningsUrl}">Open earnings</a></p>
    `
  )
}

/** A trial lesson's pay went out (trials are paid on their own, 48 hours after the lesson). */
export async function sendTrialPayoutEmail({ to, teacherName, lessonLabel, amount, earningsUrl, statementUrl }: { to: string; teacherName: string; lessonLabel: string; amount: number; earningsUrl: string; statementUrl: string }) {
  await sendEmail(
    to,
    `Trial lesson paid: £${amount.toFixed(2)}`,
    `
      <p>Assalamu alaykum ${escapeHtml(teacherName)},</p>
      <p>We've sent <strong>£${amount.toFixed(2)}</strong> to your bank account for ${escapeHtml(lessonLabel)}. It usually arrives within a few working days.</p>
      <p>Your other lessons are paid together each month, on the 3rd.</p>
      <p><a href="${statementUrl}">Your statement</a> · <a href="${earningsUrl}">Earnings</a></p>
    `
  )
}
