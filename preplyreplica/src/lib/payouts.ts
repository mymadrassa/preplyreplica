import { REPORT_WINDOW_HOURS } from '@/lib/sessionFeedback'

// How teachers are paid. A lesson becomes payable 48 hours after it ends
// unless someone reports a problem (then an admin decides).
//   - Trial lessons are paid on their own, as soon as they're payable.
//   - Every other lesson is paid in one monthly payout per teacher, on the
//     3rd, for all lessons that ended the month before: the last day of the
//     month + 48 hours has passed by then, so no lesson waits for the next
//     month (except one an admin resolves later).
// Months are counted in UTC. Amounts are integers in pence.

/** Day of the month the monthly payout goes out. */
export const PAYOUT_DAY = 3

/** When a lesson ending at `endAt` becomes payable, if nobody reports it. */
export function payoutEligibleAt(endAt: string): string {
  return new Date(new Date(endAt).getTime() + REPORT_WINDOW_HOURS * 3_600_000).toISOString()
}

/** Midnight UTC on the 1st of `now`'s month: lessons that ended before then go in this month's payout. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** The monthly payout a lesson ending at `endAt` goes in: the 3rd of the following month. */
export function payoutDateFor(endAt: string | Date): Date {
  const end = new Date(endAt)
  return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, PAYOUT_DAY))
}

/** The next monthly payout day, for "Next payout on …": this month's 3rd until it has passed, then next month's. */
export function nextPayoutDate(now: Date): Date {
  const month = now.getUTCDate() < PAYOUT_DAY ? now.getUTCMonth() : now.getUTCMonth() + 1
  return new Date(Date.UTC(now.getUTCFullYear(), month, PAYOUT_DAY))
}

/** The monthly payout a payable lesson actually goes in: its own month's, or the next one if that day has passed (e.g. resolved late). */
export function monthlyPayoutDateFor(endAt: string | Date, now: Date): Date {
  const own = payoutDateFor(endAt)
  const next = nextPayoutDate(now)
  return own > next ? own : next
}

/** The month a payout made on `payoutDay` covers, as 'YYYY-MM' (the month before). */
export function payoutPeriod(payoutDay: Date): string {
  const covered = new Date(Date.UTC(payoutDay.getUTCFullYear(), payoutDay.getUTCMonth() - 1, 1))
  return `${covered.getUTCFullYear()}-${String(covered.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "October 2026" for a 'YYYY-MM' period. */
export function periodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** What the teacher earns for one lesson: its own payment's teacher share, or one lesson's share of its package. */
export function lessonPayoutAmount(source: { payment: { teacher_fee: number } | null; pkg: { teacher_fee_per_lesson: number } | null }): number | null {
  if (source.pkg) return source.pkg.teacher_fee_per_lesson
  if (source.payment) return source.payment.teacher_fee
  return null
}

/**
 * The teacher's share left after refunding `refund` of a lesson the student
 * paid `paid` for: the refund comes out of the teacher's share and ours in
 * proportion, as the provider refunds the platform fee proportionally.
 */
export function payoutAfterPartialRefund(teacherFee: number, refund: number, paid: number): number {
  if (paid <= 0) return 0
  const kept = Math.max(0, Math.min(1, 1 - refund / paid))
  return Math.round(teacherFee * kept)
}

export interface PayableLesson {
  id: string
  teacher_id: string
  end_at: string
  is_trial: boolean
  payout_amount: number | null
}

/** Monthly payout: non-trial lessons that ended before `cutoff`, totalled per teacher (lessons without an amount are left out). */
export function groupPayouts(lessons: PayableLesson[], cutoff: Date): Map<string, { amount: number; lessonIds: string[] }> {
  const byTeacher = new Map<string, { amount: number; lessonIds: string[] }>()
  for (const lesson of lessons) {
    if (lesson.is_trial || lesson.payout_amount == null) continue
    if (new Date(lesson.end_at) >= cutoff) continue
    const entry = byTeacher.get(lesson.teacher_id) ?? { amount: 0, lessonIds: [] }
    entry.amount += lesson.payout_amount
    entry.lessonIds.push(lesson.id)
    byTeacher.set(lesson.teacher_id, entry)
  }
  return byTeacher
}
