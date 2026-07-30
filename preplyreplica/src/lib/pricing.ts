const PLATFORM_COMMISSION_RATE = 0.40 // platform keeps 40% of the teacher's base rate
const STRIPE_PERCENTAGE_FEE = 0.015    // Stripe UK/EEA card rate: 1.5%
const STRIPE_FIXED_FEE = 0.20          // + £0.20 fixed

export interface PricingBreakdown {
  teacherRate: number
  durationHours: number
  baseAmount: number
  platformCommission: number
  totalStudentPays: number
  estimatedStripeFee: number
  teacherReceives: number
  currency: 'gbp'
}

/**
 * Computes the per-booking pricing breakdown. All amounts are in pounds;
 * use toPence() to convert to the integer pence Stripe expects.
 *
 * Policy: the teacher always receives their full base rate — they never
 * absorb any part of the Stripe processing fee. The platform keeps a 40%
 * commission. The Stripe fee itself is not charged per-transaction to
 * either party; it's tracked separately (see profiles.pending_stripe_fees)
 * and billed to the student on their next booking instead.
 */
export function calculatePricing(teacherRate: number, durationHours: number): PricingBreakdown {
  const baseAmount = round2(teacherRate * durationHours)
  const platformCommission = round2(baseAmount * PLATFORM_COMMISSION_RATE)
  const totalStudentPays = round2(baseAmount + platformCommission)
  const estimatedStripeFee = round2(totalStudentPays * STRIPE_PERCENTAGE_FEE + STRIPE_FIXED_FEE)
  const teacherReceives = baseAmount

  return {
    teacherRate,
    durationHours,
    baseAmount,
    platformCommission,
    totalStudentPays,
    estimatedStripeFee,
    teacherReceives,
    currency: 'gbp',
  }
}

/** Converts a dollar amount (float) to cents (integer) for Stripe. */
export function toPence(amount: number): number {
  return Math.round(amount * 100)
}

/** Converts cents (integer) back to dollars (float). */
export function toPounds(pence: number): number {
  return round2(pence / 100)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
