// The platform's pricing model (Pricing_Model_GBP): teachers set their own
// hourly rate and always receive all of it; the platform adds a commission
// that depends on the teacher's tier, plus a flat booking fee that covers the
// card processing fee. Amounts are in pounds; toPence() converts for payments.
//
// Pure and used on both server and client (the booking form), so it never
// imports the payment provider: the server passes the provider's own fees.

export type Tier = 'starter' | 'mid' | 'top'

export interface TierRule {
  label: string
  commission: number
  /** Criteria to reach this tier (none for the entry tier). */
  minMonths?: number
  minLessons?: number
  minRating?: number
  /** Share of lesson requests the teacher declined or let time out. */
  maxCancelRate?: number
  /** Share of the teacher's students with 2+ completed lessons. */
  minRetention?: number
}

export const TIERS: Record<Tier, TierRule> = {
  starter: { label: 'Starter', commission: 0.4 },
  mid: { label: 'Mid', commission: 0.35, minMonths: 3, minLessons: 40, minRating: 4.7, maxCancelRate: 0.1 },
  top: { label: 'Top', commission: 0.3, minMonths: 6, minLessons: 100, minRating: 4.8, maxCancelRate: 0.1, minRetention: 0.5 },
}
export const TIER_ORDER: Tier[] = ['starter', 'mid', 'top']

/** Regular lessons are always one hour. */
export const LESSON_MINUTES = 60
export const BOOKING_FEE = 2
/** Same for every teacher: the fee only covers the card processing cost. */
export const TRIAL = { minutes: 20, teacherReceives: 5, bookingFee: 0.3 }
export const PACKAGE = { lessons: 10, discount: 0.1, validityMonths: 4 }

/** Card processing rate for estimates when the provider's own isn't passed (e.g. in the browser). */
export const DEFAULT_PROCESSING_FEES = { percentage: 0.015, fixed: 0.2 }
export type ProcessingFees = typeof DEFAULT_PROCESSING_FEES

export function isTier(value: unknown): value is Tier {
  return value === 'starter' || value === 'mid' || value === 'top'
}

export interface LessonPrice {
  teacherReceives: number
  commission: number
  bookingFee: number
  studentPays: number
  processingFee: number
  /** What the platform keeps: commission + booking fee − processing fee. */
  platformNet: number
}

function processingFee(amount: number, fees: ProcessingFees) {
  return round2(amount * fees.percentage + fees.fixed)
}

/** A one-hour lesson with a teacher at their rate and tier. */
export function lessonPrice(rate: number, tier: Tier, fees: ProcessingFees = DEFAULT_PROCESSING_FEES): LessonPrice {
  const commission = round2(rate * TIERS[tier].commission)
  const studentPays = round2(rate + commission + BOOKING_FEE)
  const fee = processingFee(studentPays, fees)
  return { teacherReceives: rate, commission, bookingFee: BOOKING_FEE, studentPays, processingFee: fee, platformNet: round2(commission + BOOKING_FEE - fee) }
}

/** The 20-minute trial: a fixed price whatever the teacher's rate or tier. */
export function trialPrice(fees: ProcessingFees = DEFAULT_PROCESSING_FEES): LessonPrice {
  const studentPays = round2(TRIAL.teacherReceives + TRIAL.bookingFee)
  const fee = processingFee(studentPays, fees)
  return { teacherReceives: TRIAL.teacherReceives, commission: 0, bookingFee: TRIAL.bookingFee, studentPays, processingFee: fee, platformNet: round2(TRIAL.bookingFee - fee) }
}

export interface PackagePrice {
  lessons: number
  /** Ten single lessons at full price. */
  normalPrice: number
  /** What the student pays upfront. */
  price: number
  savings: number
  /** The discounted price of one lesson: also what an unused lesson refunds. */
  perLesson: number
  teacherPerLesson: number
  /** One processing fee on the whole package. */
  processingFee: number
  platformNet: number
}

/** The 10-lesson package, paid upfront; the discount comes out of the platform's margin, never the teacher's pay. */
export function packagePrice(rate: number, tier: Tier, fees: ProcessingFees = DEFAULT_PROCESSING_FEES): PackagePrice {
  const lessons = PACKAGE.lessons
  // From the unrounded lesson price, as in the pricing sheet (Mid: 10 × £25.625 = £256.25).
  const normalPrice = round2(lessons * (rate * (1 + TIERS[tier].commission) + BOOKING_FEE))
  const price = round2(normalPrice * (1 - PACKAGE.discount))
  const fee = processingFee(price, fees)
  return {
    lessons,
    normalPrice,
    price,
    savings: round2(normalPrice - price),
    perLesson: round2(price / lessons),
    teacherPerLesson: rate,
    processingFee: fee,
    platformNet: round2(price - rate * lessons - fee),
  }
}

/** Converts pounds to integer pence, as payment providers expect. */
export function toPence(amount: number): number {
  return Math.round(amount * 100)
}

/** Converts integer pence back to pounds. */
export function toPounds(pence: number): number {
  return round2(pence / 100)
}

/** Rounds to the penny, half up (the tiny offset absorbs float error such as 3.305 → 3.3049999…). */
function round2(value: number): number {
  return Math.round(value * 100 + 1e-6) / 100
}
