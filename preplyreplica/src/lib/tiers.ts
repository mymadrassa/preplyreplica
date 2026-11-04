// Teacher tiers: which tier a teacher's track record earns, and what's left
// to reach the next one. Pure, so the daily promotion job, the dashboard
// progress bar and the tests all share one definition (thresholds live in
// TIERS, src/lib/pricing.ts).
import { TIERS, TIER_ORDER, type Tier, type TierRule } from '@/lib/pricing'

export interface TeacherStats {
  /** Whole months since the profile was approved. */
  monthsActive: number
  completedLessons: number
  ratingAvg: number
  /** Declined or timed-out requests ÷ all requests, 0–1. */
  cancelRate: number
  /** Students with 2+ completed lessons ÷ all students taught, 0–1. */
  retention: number
}

function meets(rule: TierRule, stats: TeacherStats): boolean {
  return (
    stats.monthsActive >= (rule.minMonths ?? 0) &&
    stats.completedLessons >= (rule.minLessons ?? 0) &&
    stats.ratingAvg >= (rule.minRating ?? 0) &&
    stats.cancelRate <= (rule.maxCancelRate ?? 1) &&
    stats.retention >= (rule.minRetention ?? 0)
  )
}

/** The highest tier whose criteria are all met. Tiers are cumulative: Top requires Mid's criteria too. */
export function tierFor(stats: TeacherStats): Tier {
  let earned: Tier = 'starter'
  for (const tier of TIER_ORDER.slice(1)) {
    if (!meets(TIERS[tier], stats)) break
    earned = tier
  }
  return earned
}

/** Promotion only: a tier is never lowered automatically, and an admin-set (locked) tier is kept. */
export function nextTierFor(current: Tier, stats: TeacherStats, locked: boolean): Tier {
  if (locked) return current
  const earned = tierFor(stats)
  return TIER_ORDER.indexOf(earned) > TIER_ORDER.indexOf(current) ? earned : current
}

export interface TierProgress {
  next: Tier
  /** 0–1, driven by lessons (the criterion that takes longest to move). */
  ratio: number
  /** Unmet criteria in plain words, e.g. "12 more lessons". */
  missing: string[]
}

/** What's left before the next tier; null at the top. */
export function nextTierProgress(current: Tier, stats: TeacherStats): TierProgress | null {
  const next = TIER_ORDER[TIER_ORDER.indexOf(current) + 1]
  if (!next) return null
  const rule = TIERS[next]
  const missing: string[] = []
  const lessonsLeft = Math.max(0, (rule.minLessons ?? 0) - stats.completedLessons)
  const monthsLeft = Math.max(0, (rule.minMonths ?? 0) - stats.monthsActive)
  if (lessonsLeft) missing.push(`${lessonsLeft} more lesson${lessonsLeft === 1 ? '' : 's'}`)
  if (monthsLeft) missing.push(`${monthsLeft} more month${monthsLeft === 1 ? '' : 's'} on the platform`)
  if (rule.minRating && stats.ratingAvg < rule.minRating) missing.push(`a ${rule.minRating}+ rating`)
  if (rule.maxCancelRate !== undefined && stats.cancelRate > rule.maxCancelRate) missing.push(`fewer declined requests (under ${Math.round(rule.maxCancelRate * 100)}%)`)
  if (rule.minRetention && stats.retention < rule.minRetention) missing.push(`more returning students (${Math.round(rule.minRetention * 100)}%+)`)
  return { next, ratio: rule.minLessons ? Math.min(1, stats.completedLessons / rule.minLessons) : 1, missing }
}

/** Whole months between two dates. */
export function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  return to.getDate() < from.getDate() ? months - 1 : months
}

/** Builds stats from raw booking rows (one teacher). */
export function statsFromBookings(
  bookings: { student_id: string; status: string }[],
  { approvedAt, ratingAvg, now = new Date() }: { approvedAt: string | null; ratingAvg: number; now?: Date }
): TeacherStats {
  // Requests the teacher actually had to answer: unpaid holds and cancellations don't count.
  const requests = bookings.filter((b) => !['pending_payment', 'cancelled'].includes(b.status))
  const declined = bookings.filter((b) => b.status === 'rejected').length
  const completed = bookings.filter((b) => b.status === 'completed')
  const perStudent = new Map<string, number>()
  for (const b of completed) perStudent.set(b.student_id, (perStudent.get(b.student_id) ?? 0) + 1)
  const returning = [...perStudent.values()].filter((count) => count >= 2).length
  return {
    monthsActive: approvedAt ? monthsBetween(new Date(approvedAt), now) : 0,
    completedLessons: completed.length,
    ratingAvg,
    cancelRate: requests.length ? declined / requests.length : 0,
    retention: perStudent.size ? returning / perStudent.size : 0,
  }
}
