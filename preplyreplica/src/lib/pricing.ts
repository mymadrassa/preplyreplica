const PLATFORM_COMMISSION_RATE = 0.40 // platform keeps 40% of the teacher's base rate
const STRIPE_PERCENTAGE_FEE = 0.029    // Stripe US card rate: 2.9%
const STRIPE_FIXED_FEE = 0.30          // + $0.30 fixed
const STUDENT_STRIPE_FEE_SHARE = 0.5   // student absorbs 50% of the Stripe fee
const TEACHER_STRIPE_FEE_SHARE = 0.5   // teacher absorbs 50% of the Stripe fee

export interface PricingBreakdown {
  teacherRate: number
  durationHours: number
  baseAmount: number
  platformCommission: number
  subtotal: number
  estimatedStripeFee: number
  studentStripeFee: number
  teacherStripeFee: number
  totalStudentPays: number
  teacherReceives: number
  platformNetRevenue: number
  currency: 'usd'
}

/**
 * Computes the full pricing breakdown for a booking. All amounts are in
 * dollars; use toPence() to convert to the integer cents Stripe expects.
 *
 * Model: the platform adds a 40% commission on top of the teacher's base
 * rate, then Stripe's processing fee on the resulting subtotal is split
 * evenly between student and teacher (nobody absorbs it on the platform's
 * behalf). Netting it out, the platform's actual revenue always equals the
 * commission alone — the Stripe fee split is a wash on the platform's side.
 */
export function calculatePricing(teacherRate: number, durationHours: number): PricingBreakdown {
  const baseAmount = round2(teacherRate * durationHours)
  const platformCommission = round2(baseAmount * PLATFORM_COMMISSION_RATE)
  const subtotal = round2(baseAmount + platformCommission)

  const estimatedStripeFee = round2(subtotal * STRIPE_PERCENTAGE_FEE + STRIPE_FIXED_FEE)

  const studentStripeFee = round2(estimatedStripeFee * STUDENT_STRIPE_FEE_SHARE)
  const teacherStripeFee = round2(estimatedStripeFee * TEACHER_STRIPE_FEE_SHARE)

  const totalStudentPays = round2(subtotal + studentStripeFee)
  const teacherReceives = round2(baseAmount - teacherStripeFee)
  const platformNetRevenue = round2(totalStudentPays - teacherReceives - estimatedStripeFee)

  return {
    teacherRate,
    durationHours,
    baseAmount,
    platformCommission,
    subtotal,
    estimatedStripeFee,
    studentStripeFee,
    teacherStripeFee,
    totalStudentPays,
    teacherReceives,
    platformNetRevenue,
    currency: 'usd',
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
