import { LESSON_MINUTES, PACKAGE, TIERS, TRIAL, lessonPrice, packagePrice, toPence, trialPrice, type Tier } from '@/lib/pricing'

// What receipts and teacher statements show, worked out from what was
// charged. My Madrassa sells the lessons: the student pays My Madrassa, Stripe
// takes its card fee, the teacher is paid their rate, and My Madrassa keeps
// the rest. Pure, for tests and both kinds of document. Amounts in pence.

/** What My Madrassa keeps from a payment: the price, less the teachers' pay and the card fee. */
export function platformShare(paid: number, teacherPay: number, processingFee: number): number {
  return paid - teacherPay - processingFee
}

// ---- Card region (for "card fee: UK / European / international card") ----

const EUROPE = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'CH',
])

export type CardRegion = 'uk' | 'europe' | 'international'

export function cardRegion(country: string | null | undefined): CardRegion | null {
  if (!country) return null
  const code = country.toUpperCase()
  if (code === 'GB') return 'uk'
  return EUROPE.has(code) ? 'europe' : 'international'
}

export const CARD_REGION_LABELS: Record<CardRegion, string> = { uk: 'UK card', europe: 'European card', international: 'International card' }

// ---- References and dates ----

/** A short, stable reference shown on a document: MM-R-… for a receipt, MM-P-… for a payout statement. */
export function documentNumber(kind: 'R' | 'P', id: string): string {
  return `MM-${kind}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

/** The UK tax year a date falls in, by its starting year (6 April to 5 April). */
export function taxYearOf(date: Date | string): number {
  const d = new Date(date)
  const year = d.getUTCFullYear()
  const startsThisYear = d >= new Date(Date.UTC(year, 3, 6))
  return startsThisYear ? year : year - 1
}

/** 6 April of `startYear` (inclusive) to 6 April the year after (exclusive). */
export function taxYearRange(startYear: number): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(startYear, 3, 6)), end: new Date(Date.UTC(startYear + 1, 3, 6)) }
}

/** "2026–27". */
export function taxYearLabel(startYear: number): string {
  return `${startYear}–${String((startYear + 1) % 100).padStart(2, '0')}`
}

// ---- VAT (only shown once a VAT number is configured) ----

export const VAT_RATE = 0.2

/** The VAT inside a VAT-inclusive amount (1/6 of it at 20%). */
export function vatIncluded(gross: number, rate = VAT_RATE): number {
  return Math.round((gross * rate) / (1 + rate))
}

// ---- Student receipts ----

export interface ReceiptLine {
  label: string
  amount: number
  detail?: string
  tone?: 'discount' | 'total' | 'refund' | 'net'
}

export interface MoneySplit {
  teacher: number
  cardFee: number
  /** True when the real fee isn't known yet and an estimate is shown. */
  cardFeeEstimated: boolean
  platform: number
}

export interface StudentReceipt {
  lines: ReceiptLine[]
  total: number
  refunded: number
  netPaid: number
  split: MoneySplit
}

function split(paid: number, teacher: number, processingFee: number | null, estimate: number): MoneySplit {
  const cardFee = processingFee ?? estimate
  return { teacher, cardFee, cardFeeEstimated: processingFee == null, platform: platformShare(paid, teacher, cardFee) }
}

function withRefunds(lines: ReceiptLine[], total: number, refunded: number): Pick<StudentReceipt, 'lines' | 'refunded' | 'netPaid'> {
  const out = [...lines, { label: 'Total paid', amount: total, tone: 'total' as const }]
  if (refunded > 0) {
    out.push({ label: 'Refunded', amount: -refunded, tone: 'refund' })
    out.push({ label: 'Net paid', amount: total - refunded, tone: 'net' })
  }
  return { lines: out, refunded, netPaid: total - refunded }
}

/** The trial: the lesson price (the teacher's pay and the booking fee), and where the money goes. */
export function trialReceipt(input: { amount: number; teacherFee: number; processingFee: number | null; refunded: number; teacherName: string }): StudentReceipt {
  const price = trialPrice()
  const bookingFee = input.amount - input.teacherFee
  const lines: ReceiptLine[] = [
    {
      label: `${TRIAL.minutes}-minute trial lesson with ${input.teacherName}`,
      amount: input.amount,
      detail: `Teacher's pay £${(input.teacherFee / 100).toFixed(2)} + My Madrassa booking fee £${(bookingFee / 100).toFixed(2)}`,
    },
  ]
  return { ...withRefunds(lines, input.amount, input.refunded), total: input.amount, split: split(input.amount, input.teacherFee, input.processingFee, toPence(price.processingFee)) }
}

/**
 * A package: the platform price of one lesson at the teacher's tier
 * (teacher's pay + commission + booking fee), ten of them, the package
 * discount, and where the money goes.
 */
export function packageReceipt(input: { price: number; lessons: number; tier: Tier; teacherFeePerLesson: number; processingFee: number | null; refunded: number; teacherName: string }): StudentReceipt {
  const lesson = lessonPrice(input.tier)
  const normal = toPence(packagePrice(input.tier).normalPrice)
  const commissionPct = Math.round(TIERS[input.tier].commission * 100)
  const lines: ReceiptLine[] = [
    {
      label: `Platform price of one ${LESSON_MINUTES}-minute lesson with ${input.teacherName}`,
      amount: toPence(lesson.studentPays),
      detail: `Teacher's pay £${lesson.teacherReceives.toFixed(2)} + My Madrassa commission (${commissionPct}%) £${lesson.commission.toFixed(2)} + booking fee £${lesson.bookingFee.toFixed(2)}`,
    },
    { label: `${input.lessons} lessons at the platform price`, amount: normal },
    { label: `Package discount (${Math.round(PACKAGE.discount * 100)}%)`, amount: input.price - normal, tone: 'discount' },
  ]
  const teacherTotal = input.teacherFeePerLesson * input.lessons
  const estimate = toPence(packagePrice(input.tier).processingFee)
  return { ...withRefunds(lines, input.price, input.refunded), total: input.price, split: split(input.price, teacherTotal, input.processingFee, estimate) }
}

// ---- Teacher statements ----

export interface StatementRow {
  bookingId: string
  date: string
  studentName: string
  subject: string
  kind: 'trial' | 'package' | 'lesson'
  studentPaid: number
  cardFee: number
  platform: number
  teacherPay: number
}

/**
 * One lesson on a teacher's statement. A package lesson shows one tenth of
 * the package (price and card fee). My Madrassa's share is what's left once
 * the card fee and the teacher's pay are taken out, so each row adds up.
 */
export function statementRow(input: {
  bookingId: string
  date: string
  studentName: string
  subject: string
  isTrial: boolean
  teacherPay: number
  payment?: { amount: number; refunded: number; processingFee: number | null; estimate: number } | null
  pkg?: { price: number; lessons: number; processingFee: number | null; estimate: number } | null
}): StatementRow {
  const share = (total: number, n: number) => Math.round(total / n)
  const studentPaid = input.pkg ? share(input.pkg.price, input.pkg.lessons) : input.payment ? input.payment.amount - input.payment.refunded : 0
  const cardFee = input.pkg ? share(input.pkg.processingFee ?? input.pkg.estimate, input.pkg.lessons) : input.payment ? (input.payment.processingFee ?? input.payment.estimate) : 0
  return {
    bookingId: input.bookingId,
    date: input.date,
    studentName: input.studentName,
    subject: input.subject,
    kind: input.isTrial ? 'trial' : input.pkg ? 'package' : 'lesson',
    studentPaid,
    cardFee,
    platform: platformShare(studentPaid, input.teacherPay, cardFee),
    teacherPay: input.teacherPay,
  }
}

export function statementTotals(rows: StatementRow[]) {
  return rows.reduce(
    (t, r) => ({ studentPaid: t.studentPaid + r.studentPaid, cardFee: t.cardFee + r.cardFee, platform: t.platform + r.platform, teacherPay: t.teacherPay + r.teacherPay }),
    { studentPaid: 0, cardFee: 0, platform: 0, teacherPay: 0 }
  )
}
