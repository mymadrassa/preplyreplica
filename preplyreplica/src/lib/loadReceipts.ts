import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { loadParticipants } from '@/lib/participantNames'
import { recordLessonPaymentFees, recordPackagePaymentFees } from '@/lib/paymentFees'
import { isTier, packagePrice, toPence, trialPrice } from '@/lib/pricing'
import { packageReceipt, statementRow, statementTotals, taxYearRange, trialReceipt, type StatementRow, type StudentReceipt } from '@/lib/receipts'

// Loads receipts and statements with the server key, after checking the
// viewer may see them: the student who paid, the teacher concerned, or an
// admin. Returns null when the document doesn't exist or isn't theirs.

type Db = ReturnType<typeof createSupabaseServiceRoleClient>

async function isAdmin(db: Db, userId: string) {
  const { data } = await db.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

export interface ReceiptDoc {
  id: string
  studentId: string
  kind: 'trial' | 'package'
  status: 'paid' | 'refunded' | 'not_charged' | 'on_hold'
  paidAt: string | null
  studentName: string
  teacherName: string
  /** What was bought, for the heading (e.g. the lesson's subject and time). */
  summary: string
  cardCountry: string | null
  receipt: StudentReceipt
}

/** A trial's receipt. */
export async function loadPaymentReceipt(paymentId: string, viewerId: string): Promise<ReceiptDoc | null> {
  const db = createSupabaseServiceRoleClient()
  const { data: found } = await db.from('payments').select('*, bookings(student_id, teacher_id, subject, start_at)').eq('id', paymentId).maybeSingle()
  const booking = found?.bookings as { student_id: string; teacher_id: string; subject: string; start_at: string } | null
  if (!found || !booking) return null
  if (viewerId !== booking.student_id && viewerId !== booking.teacher_id && !(await isAdmin(db, viewerId))) return null

  // Charged before fees were recorded: ask the provider once.
  let payment = found
  if (payment.processing_fee == null && (payment.status === 'succeeded' || payment.status === 'refunded')) {
    const fees = await recordLessonPaymentFees(payment.id, db)
    if (fees) payment = { ...payment, processing_fee: fees.processing_fee, platform_amount: fees.platform_amount, card_country: fees.card_country, paid_at: fees.paid_at }
  }
  const people = await loadParticipants([booking.student_id, booking.teacher_id])
  const teacherName = people.get(booking.teacher_id)?.name ?? 'your teacher'
  const status =
    payment.status === 'refunded' || (payment.refunded_amount > 0 && payment.refunded_amount >= payment.amount)
      ? 'refunded'
      : payment.status === 'succeeded'
        ? 'paid'
        : payment.status === 'authorized'
          ? 'on_hold'
          : 'not_charged'
  return {
    id: payment.id,
    studentId: booking.student_id,
    kind: 'trial',
    status,
    paidAt: payment.paid_at,
    studentName: people.get(booking.student_id)?.name ?? 'Student',
    teacherName,
    summary: `${booking.subject} · ${new Date(booking.start_at).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}`,
    cardCountry: payment.card_country,
    receipt: trialReceipt({ amount: payment.amount, teacherFee: payment.teacher_fee, processingFee: payment.processing_fee, refunded: payment.refunded_amount, teacherName }),
  }
}

/** A package's receipt. */
export async function loadPackageReceipt(packageId: string, viewerId: string): Promise<ReceiptDoc | null> {
  const db = createSupabaseServiceRoleClient()
  const { data: found } = await db.from('lesson_packages').select('*').eq('id', packageId).maybeSingle()
  if (!found) return null
  if (viewerId !== found.student_id && viewerId !== found.teacher_id && !(await isAdmin(db, viewerId))) return null

  let pkg = found
  const charged = pkg.status !== 'pending_payment' && Boolean(pkg.provider_payment_id)
  if (charged && pkg.processing_fee == null) {
    const fees = await recordPackagePaymentFees(pkg.id, db)
    if (fees) pkg = { ...pkg, processing_fee: fees.processing_fee, platform_amount: fees.platform_amount, card_country: fees.card_country, paid_at: fees.paid_at }
  }
  const people = await loadParticipants([pkg.student_id, pkg.teacher_id])
  const teacherName = people.get(pkg.teacher_id)?.name ?? 'your teacher'
  return {
    id: pkg.id,
    studentId: pkg.student_id,
    kind: 'package',
    status: !charged ? 'not_charged' : pkg.refunded_amount >= pkg.price ? 'refunded' : 'paid',
    paidAt: pkg.paid_at,
    studentName: people.get(pkg.student_id)?.name ?? 'Student',
    teacherName,
    summary: `${pkg.lessons_total} one-hour lessons with ${teacherName}${pkg.expires_at ? `, valid until ${new Date(pkg.expires_at).toLocaleDateString('en-GB', { dateStyle: 'long' })}` : ''}`,
    cardCountry: pkg.card_country,
    receipt: packageReceipt({
      price: pkg.price,
      lessons: pkg.lessons_total,
      tier: isTier(pkg.tier) ? pkg.tier : 'starter',
      teacherFeePerLesson: pkg.teacher_fee_per_lesson,
      processingFee: pkg.processing_fee,
      refunded: pkg.refunded_amount,
      teacherName,
    }),
  }
}

/** The statement rows of a set of lessons (by id), for payouts and yearly summaries. */
async function statementRows(db: Db, bookingIds: string[]): Promise<StatementRow[]> {
  if (!bookingIds.length) return []
  const { data: lessons } = await db
    .from('bookings')
    .select('id, student_id, subject, start_at, is_trial, package_id, payout_amount')
    .in('id', bookingIds)
    .order('start_at', { ascending: true })
  const rows = lessons ?? []
  const packageIds = [...new Set(rows.map((l) => l.package_id).filter((id): id is string => Boolean(id)))]
  const [{ data: packages }, { data: payments }, people] = await Promise.all([
    packageIds.length ? db.from('lesson_packages').select('id, price, lessons_total, processing_fee, tier').in('id', packageIds) : Promise.resolve({ data: [] }),
    db.from('payments').select('booking_id, amount, refunded_amount, processing_fee').in('booking_id', rows.filter((l) => !l.package_id).map((l) => l.id)),
    loadParticipants(rows.map((l) => l.student_id)),
  ])
  return rows.map((lesson) => {
    const pkg = packages?.find((p) => p.id === lesson.package_id)
    const payment = payments?.find((p) => p.booking_id === lesson.id)
    return statementRow({
      bookingId: lesson.id,
      date: lesson.start_at,
      studentName: people.get(lesson.student_id)?.name ?? 'Student',
      subject: lesson.subject,
      isTrial: lesson.is_trial,
      teacherPay: lesson.payout_amount ?? 0,
      pkg: pkg
        ? { price: pkg.price, lessons: pkg.lessons_total, processingFee: pkg.processing_fee, estimate: toPence(packagePrice(isTier(pkg.tier) ? pkg.tier : 'starter').processingFee) }
        : null,
      payment: payment ? { amount: payment.amount, refunded: payment.refunded_amount, processingFee: payment.processing_fee, estimate: toPence(trialPrice().processingFee) } : null,
    })
  })
}

export interface PayoutStatement {
  payout: { id: string; period: string; amount: number; lessonsCount: number; status: string; paidAt: string | null; isTrial: boolean; transferId: string | null; payoutId: string | null }
  teacherName: string
  rows: StatementRow[]
  totals: ReturnType<typeof statementTotals>
}

/** A teacher's statement for one payout (monthly or a trial). */
export async function loadPayoutStatement(payoutId: string, viewerId: string): Promise<PayoutStatement | null> {
  const db = createSupabaseServiceRoleClient()
  const { data: payout } = await db.from('teacher_payouts').select('*').eq('id', payoutId).maybeSingle()
  if (!payout) return null
  if (viewerId !== payout.teacher_id && !(await isAdmin(db, viewerId))) return null
  const { data: lessons } = await db.from('bookings').select('id').eq('payout_batch_id', payout.id)
  const rows = await statementRows(db, (lessons ?? []).map((l) => l.id))
  const people = await loadParticipants([payout.teacher_id])
  return {
    payout: {
      id: payout.id,
      period: payout.period,
      amount: payout.amount,
      lessonsCount: payout.lessons_count,
      status: payout.status,
      paidAt: payout.paid_at,
      isTrial: Boolean(payout.booking_id),
      transferId: payout.provider_transfer_id,
      payoutId: payout.provider_payout_id,
    },
    teacherName: people.get(payout.teacher_id)?.name ?? 'Teacher',
    rows,
    totals: statementTotals(rows),
  }
}

export interface TaxYearSummary {
  startYear: number
  teacherName: string
  payouts: { id: string; period: string; amount: number; lessonsCount: number; paidAt: string; isTrial: boolean }[]
  rows: StatementRow[]
  totals: ReturnType<typeof statementTotals>
  paidOut: number
}

/** A teacher's year (6 April to 5 April): every payout sent in it and the lessons they covered. */
export async function loadTaxYearSummary(teacherId: string, startYear: number, viewerId: string): Promise<TaxYearSummary | null> {
  const db = createSupabaseServiceRoleClient()
  if (viewerId !== teacherId && !(await isAdmin(db, viewerId))) return null
  const { start, end } = taxYearRange(startYear)
  const { data: payouts } = await db
    .from('teacher_payouts')
    .select('id, period, amount, lessons_count, paid_at, booking_id')
    .eq('teacher_id', teacherId)
    .eq('status', 'paid')
    .gte('paid_at', start.toISOString())
    .lt('paid_at', end.toISOString())
    .order('paid_at', { ascending: true })
  const list = payouts ?? []
  const { data: lessons } = list.length ? await db.from('bookings').select('id').in('payout_batch_id', list.map((p) => p.id)) : { data: [] }
  const rows = await statementRows(db, (lessons ?? []).map((l) => l.id))
  const people = await loadParticipants([teacherId])
  return {
    startYear,
    teacherName: people.get(teacherId)?.name ?? 'Teacher',
    payouts: list.map((p) => ({ id: p.id, period: p.period, amount: p.amount, lessonsCount: p.lessons_count, paidAt: p.paid_at as string, isTrial: Boolean(p.booking_id) })),
    rows,
    totals: statementTotals(rows),
    paidOut: list.reduce((sum, p) => sum + p.amount, 0),
  }
}
