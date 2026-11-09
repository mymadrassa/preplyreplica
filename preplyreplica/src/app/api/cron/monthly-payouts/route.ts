import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { getPaymentProvider } from '@/lib/payments'
import { paymentErrorMessage } from '@/lib/payments/types'
import { loadAdmins, settleEndedLessons } from '@/lib/lessonPayouts'
import { PAYOUT_DAY, groupPayouts, monthStart, payoutPeriod, periodLabel } from '@/lib/payouts'
import { sendMonthlyPayoutEmail, sendPayoutFailedEmail, sendTrialPayoutEmail } from '@/lib/email'
import { formatBookingDateTime } from '@/lib/format'
import { toPounds } from '@/lib/pricing'
import { appUrl } from '@/lib/appUrl'

type Db = ReturnType<typeof createSupabaseServiceRoleClient>
type PayoutRow = { id: string; teacher_id: string; booking_id: string | null; period: string; amount: number; lessons_count: number; provider: string; attempts: number; transferred_amount: number }
const PAYOUT_FIELDS = 'id, teacher_id, booking_id, period, amount, lessons_count, provider, attempts, transferred_amount'

/**
 * Teachers' pay (see lib/payouts.ts). Each payout transfers what My Madrassa
 * owes into the teacher's Stripe account, then pays it out to their bank.
 * Runs every day:
 *   - trial lessons that became payable (48 hours after the end, nothing
 *     reported) are paid on their own;
 *   - on the 3rd (or with ?force=1, for testing), every other payable lesson
 *     that ended before this month is totalled per teacher and sent in one
 *     payout each;
 *   - payouts that failed (e.g. the balance wasn't available yet, or bank
 *     details are missing) are tried again.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServiceRoleClient()
  const now = new Date()
  const results: Array<{ teacherId: string; period: string; amount: number; action: string; error?: string }> = []
  const triedNow = new Set<string>()

  // Lessons whose 48 hours ended since the last run become payable now.
  await settleEndedLessons(now)

  // Trial lessons: one payout each.
  const { data: trials } = await db
    .from('bookings')
    .select('id, teacher_id, end_at, payout_amount')
    .eq('is_trial', true)
    .eq('payout_state', 'scheduled')
    .is('payout_batch_id', null)
    .not('payout_amount', 'is', null)
  for (const trial of trials ?? []) {
    const { data: payout, error } = await db
      .from('teacher_payouts')
      .insert({ teacher_id: trial.teacher_id, booking_id: trial.id, period: trial.end_at.slice(0, 7), amount: trial.payout_amount ?? 0, lessons_count: 1 })
      .select(PAYOUT_FIELDS)
      .single()
    if (error || !payout) {
      results.push({ teacherId: trial.teacher_id, period: trial.end_at.slice(0, 7), amount: trial.payout_amount ?? 0, action: 'skipped', error: error?.message })
      continue
    }
    await db.from('bookings').update({ payout_batch_id: payout.id }).eq('id', trial.id)
    triedNow.add(payout.id)
    results.push(await sendPayout(db, payout))
  }

  // The monthly payout, for every other lesson of the month before.
  if (now.getUTCDate() === PAYOUT_DAY || new URL(request.url).searchParams.get('force') === '1') {
    const cutoff = monthStart(now)
    const period = payoutPeriod(cutoff)
    const { data: payable } = await db
      .from('bookings')
      .select('id, teacher_id, end_at, is_trial, payout_amount')
      .eq('payout_state', 'scheduled')
      .eq('is_trial', false)
      .is('payout_batch_id', null)
      .lt('end_at', cutoff.toISOString())

    for (const [teacherId, group] of groupPayouts(payable ?? [], cutoff)) {
      // One monthly payout per teacher: a second run that month adds nothing new.
      const { data: payout, error } = await db
        .from('teacher_payouts')
        .insert({ teacher_id: teacherId, period, amount: group.amount, lessons_count: group.lessonIds.length })
        .select(PAYOUT_FIELDS)
        .single()
      if (error || !payout) {
        results.push({ teacherId, period, amount: group.amount, action: 'skipped', error: error?.code === '23505' ? 'Already paid for this month' : error?.message })
        continue
      }
      await db.from('bookings').update({ payout_batch_id: payout.id }).in('id', group.lessonIds)
      triedNow.add(payout.id)
      results.push(await sendPayout(db, payout))
    }
  }

  // Failed payouts from earlier days.
  const { data: failed } = await db.from('teacher_payouts').select(PAYOUT_FIELDS).eq('status', 'failed')
  for (const payout of (failed ?? []).filter((p) => !triedNow.has(p.id))) {
    results.push(await sendPayout(db, payout, { retry: true }))
  }

  return NextResponse.json({ processed: results.length, results })
}

/** Sends one payout and records the outcome; emails the teacher (and admins on failure). */
async function sendPayout(db: Db, payout: PayoutRow, { retry = false } = {}) {
  const base = { teacherId: payout.teacher_id, period: payout.period, amount: payout.amount }
  const [{ data: teacher }, { data: contact }, { data: trial }] = await Promise.all([
    db.from('teacher_profiles').select('payout_account_id').eq('id', payout.teacher_id).maybeSingle(),
    db.from('profiles').select('full_name, email').eq('id', payout.teacher_id).maybeSingle(),
    payout.booking_id ? db.from('bookings').select('subject, start_at').eq('id', payout.booking_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const teacherName = contact?.full_name || contact?.email?.split('@')[0] || 'Teacher'
  const label = trial ? `your trial lesson (${trial.subject}, ${formatBookingDateTime(trial.start_at)})` : periodLabel(payout.period)
  const earningsUrl = appUrl('/teacher/earnings')
  const statementUrl = appUrl(`/receipts/payout/${payout.id}`)

  try {
    if (!teacher?.payout_account_id) throw new Error('No payout account set up.')
    const provider = getPaymentProvider(payout.provider)
    // 1. Move what My Madrassa owes into the teacher's Stripe account (lessons paid
    //    to My Madrassa; older direct charges are already there). Never twice.
    const funding = await platformFunding(db, payout)
    if (funding.amount > payout.transferred_amount) {
      const { transferId } = await provider.transfer({
        payeeAccountId: teacher.payout_account_id,
        amount: funding.amount - payout.transferred_amount,
        currency: 'gbp',
        sourcePaymentId: funding.sourcePaymentId,
        idempotencyKey: `teacher-payout-${payout.id}-transfer`,
        description: trial ? 'Trial lesson pay' : `Lessons of ${periodLabel(payout.period)}`,
      })
      await db.from('teacher_payouts').update({ provider_transfer_id: transferId, transferred_amount: funding.amount }).eq('id', payout.id)
    }
    // 2. Send it to their bank.
    if (payout.amount > 0) {
      const { payoutId } = await provider.payout({ payeeAccountId: teacher.payout_account_id, amount: payout.amount, currency: 'gbp', idempotencyKey: `teacher-payout-${payout.id}-${payout.attempts + 1}` })
      await db.from('teacher_payouts').update({ provider_payout_id: payoutId }).eq('id', payout.id)
    }
  } catch (error) {
    const reason = paymentErrorMessage(error, 'The payout failed.')
    await db.from('teacher_payouts').update({ status: 'failed', failure_reason: reason, attempts: payout.attempts + 1 }).eq('id', payout.id)
    // Tell people once, on the first failure; retries stay quiet until it goes through.
    if (!retry) {
      const admins = await loadAdmins()
      const to = [contact?.email, ...admins.emails].filter((email): email is string => Boolean(email))
      if (to.length) {
        await sendPayoutFailedEmail({ to, teacherName, periodLabel: label, amount: toPounds(payout.amount), reason, earningsUrl }).catch((e) => console.error('[payouts] failure email', e))
      }
    }
    return { ...base, action: retry ? 'retry_failed' : 'failed', error: reason }
  }

  const paidAt = new Date().toISOString()
  await db.from('teacher_payouts').update({ status: 'paid', paid_at: paidAt, failure_reason: null, attempts: payout.attempts + 1 }).eq('id', payout.id)
  const { data: lessons } = await db.from('bookings').update({ payout_state: 'paid' }).eq('payout_batch_id', payout.id).select('id')
  const lessonIds = (lessons ?? []).map((l) => l.id)
  if (lessonIds.length) await db.from('payments').update({ payout_at: paidAt }).in('booking_id', lessonIds).eq('status', 'succeeded')

  if (contact?.email && payout.amount > 0) {
    const email = trial
      ? sendTrialPayoutEmail({ to: contact.email, teacherName, lessonLabel: label, amount: toPounds(payout.amount), earningsUrl, statementUrl })
      : sendMonthlyPayoutEmail({ to: contact.email, teacherName, periodLabel: label, lessons: payout.lessons_count, amount: toPounds(payout.amount), earningsUrl, statementUrl })
    await email.catch((e) => console.error('[payouts] summary email', e))
  }
  return { ...base, action: retry ? 'retried_paid' : 'paid' }
}

/**
 * How much of a payout My Madrassa must transfer first: the lessons whose
 * student paid My Madrassa (not older direct charges, already in the
 * teacher's account). A trial's transfer is tied to its payment.
 */
async function platformFunding(db: Db, payout: PayoutRow): Promise<{ amount: number; sourcePaymentId: string | null }> {
  const { data: lessons } = await db.from('bookings').select('id, package_id, payout_amount').eq('payout_batch_id', payout.id)
  const rows = lessons ?? []
  const packageIds = [...new Set(rows.map((l) => l.package_id).filter((id): id is string => Boolean(id)))]
  const lessonIds = rows.filter((l) => !l.package_id).map((l) => l.id)
  const [{ data: packages }, { data: payments }] = await Promise.all([
    packageIds.length ? db.from('lesson_packages').select('id, charge_model').in('id', packageIds) : Promise.resolve({ data: [] as { id: string; charge_model: string }[] }),
    lessonIds.length ? db.from('payments').select('booking_id, charge_model, provider_payment_id').in('booking_id', lessonIds) : Promise.resolve({ data: [] as { booking_id: string; charge_model: string; provider_payment_id: string | null }[] }),
  ])
  const onPlatform = (lesson: (typeof rows)[number]) =>
    lesson.package_id ? packages?.find((p) => p.id === lesson.package_id)?.charge_model === 'platform' : payments?.find((p) => p.booking_id === lesson.id)?.charge_model === 'platform'
  const amount = rows.filter(onPlatform).reduce((sum, l) => sum + (l.payout_amount ?? 0), 0)
  const sourcePaymentId = payout.booking_id ? (payments?.find((p) => p.booking_id === payout.booking_id && p.charge_model === 'platform')?.provider_payment_id ?? null) : null
  return { amount, sourcePaymentId }
}
