const PLATFORM_COMMISSION_RATE = 0.40; // 40%
const STRIPE_PERCENTAGE_FEE = 0.015;    // 1.5% (cartes UK/EEA)
const STRIPE_FIXED_FEE = 0.20;          // £0.20 fixe
const STUDENT_STRIPE_FEE_SHARE = 0.5;   // 50% des frais Stripe pour l'élève
const TEACHER_STRIPE_FEE_SHARE = 0.5;   // 50% des frais Stripe pour le prof

export interface PricingBreakdown {
  teacherRate: number;
  durationHours: number;
  baseAmount: number;
  platformCommission: number;
  subtotal: number;
  estimatedStripeFee: number;
  studentStripeFee: number;
  teacherStripeFee: number;
  totalStudentPays: number;
  teacherReceives: number;
  platformNetRevenue: number;
  currency: 'gbp';
}

/**
 * Calcule tous les montants pour une réservation
 * Tous les montants internes sont en PENCE (plus petite unité GBP) pour Stripe
 * @param teacherRate - Tarif horaire du prof en GBP (ex: 20.00)
 * @param durationHours - Durée du cours en heures (ex: 1, 0.5, 1.5, 2)
 */
export function calculatePricing(
  teacherRate: number,
  durationHours: number
): PricingBreakdown {
  const baseAmount = round2(teacherRate * durationHours);
  const platformCommission = round2(baseAmount * PLATFORM_COMMISSION_RATE);
  const subtotal = round2(baseAmount + platformCommission);

  const estimatedStripeFee = round2(
    subtotal * STRIPE_PERCENTAGE_FEE + STRIPE_FIXED_FEE
  );

  const studentStripeFee = round2(estimatedStripeFee * STUDENT_STRIPE_FEE_SHARE);
  const teacherStripeFee = round2(estimatedStripeFee * TEACHER_STRIPE_FEE_SHARE);

  const totalStudentPays = round2(subtotal + studentStripeFee);
  const teacherReceives = round2(baseAmount - teacherStripeFee);
  const platformNetRevenue = round2(
    totalStudentPays - teacherReceives - estimatedStripeFee
  );

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
    currency: 'gbp',
  };
}

/** Convertit un montant GBP (float) en pence (integer) pour Stripe */
export function toPence(amount: number): number {
  return Math.round(amount * 100);
}

/** Convertit des pence (integer) en GBP (float) */
export function toPounds(pence: number): number {
  return round2(pence / 100);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
