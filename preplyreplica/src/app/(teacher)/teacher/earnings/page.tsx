import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarClock, FileText, Hourglass, Banknote } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { EarningsTrendChart } from '@/components/EarningsTrendChart'
import { toPounds } from '@/lib/pricing'
import { formatBookingDateTime } from '@/lib/format'
import { monthStart, monthlyPayoutDateFor, nextPayoutDate, periodLabel } from '@/lib/payouts'
import { REPORT_WINDOW_HOURS } from '@/lib/sessionFeedback'
import { loadParticipants } from '@/lib/participantNames'
import type { PayoutState } from '@/types/database'
import { taxYearLabel, taxYearOf } from '@/lib/receipts'

const PAYOUT_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Sending', tone: 'pending' },
  paid: { label: 'Paid', tone: 'approved' },
  failed: { label: 'Retrying', tone: 'rejected' },
}

function monthKey(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function pounds(pence: number) {
  return `£${toPounds(pence).toFixed(2)}`
}

const shortDate = (date: Date | string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

/**
 * The teacher's pay: the next monthly payout (on the 3rd, for every lesson
 * of the month before), trial lessons (paid on their own 48 hours after),
 * lessons on hold, every payout sent, and each lesson's earnings.
 */
export default async function TeacherEarningsPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    redirect('/auth/login')
  }

  const now = new Date()
  const [{ data: bookings }, { data: payouts }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, subject, start_at, end_at, student_id, status, is_trial, package_id, payout_state, payout_amount, payout_eligible_at')
      .eq('teacher_id', userId)
      .or(`status.eq.completed,payout_state.neq.none,and(status.eq.confirmed,end_at.lte.${now.toISOString()})`)
      .order('start_at', { ascending: false })
      .limit(300),
    supabase.from('teacher_payouts').select('*').eq('teacher_id', userId).order('period', { ascending: false }),
  ])
  const lessons = bookings ?? []
  const students = await loadParticipants(lessons.map((l) => l.student_id))

  const nextDay = nextPayoutDate(now)
  const sum = (rows: typeof lessons) => rows.reduce((total, l) => total + (l.payout_amount ?? 0), 0)
  // Every lesson of the month before the next payout day goes in it, the ones still in their 48 hours included.
  const nextCutoff = monthStart(nextDay)
  const nextPayout = lessons.filter((l) => !l.is_trial && (l.payout_state === 'scheduled' || l.payout_state === 'none') && l.status !== 'cancelled' && new Date(l.end_at) < nextCutoff)
  const comingTrials = lessons.filter((l) => l.is_trial && (l.payout_state === 'scheduled' || l.payout_state === 'none') && l.status !== 'cancelled')
  const later = lessons.filter((l) => !l.is_trial && (l.payout_state === 'scheduled' || l.payout_state === 'none') && l.status !== 'cancelled' && !nextPayout.includes(l))
  const held = lessons.filter((l) => l.payout_state === 'held')
  const paidOut = (payouts ?? []).filter((p) => p.status === 'paid').reduce((total, p) => total + p.amount, 0)
  // Tax years with a payout, plus the current one, newest first.
  const taxYears = [...new Set([taxYearOf(now), ...(payouts ?? []).filter((p) => p.paid_at).map((p) => taxYearOf(p.paid_at as string))])].sort((a, b) => b - a)

  // Earnings per month of the lesson, last 6 months, oldest first.
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1) // pin to the 1st before subtracting months, so this never rolls into the wrong month
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const amountPence = sum(lessons.filter((l) => l.payout_state !== 'refunded' && monthKey(l.start_at) === key))
    return { month: d.toLocaleDateString('en-GB', { month: 'short' }), amountPence }
  })

  const lessonStatus = (lesson: (typeof lessons)[number]): { label: string; tone: string } => {
    const state = lesson.payout_state as PayoutState
    if (state === 'paid') return { label: 'Paid', tone: 'approved' }
    if (state === 'refunded') return { label: 'Refunded to student', tone: 'cancelled' }
    if (state === 'held') return { label: 'On hold · problem reported', tone: 'rejected' }
    if (lesson.is_trial) {
      if (state === 'scheduled') return { label: 'Being sent', tone: 'confirmed' }
      const from = lesson.payout_eligible_at ? new Date(lesson.payout_eligible_at) : new Date(new Date(lesson.end_at).getTime() + REPORT_WINDOW_HOURS * 3_600_000)
      return { label: `Paid from ${shortDate(from)}`, tone: 'pending' }
    }
    return { label: `In the ${shortDate(monthlyPayoutDateFor(lesson.end_at, now))} payout`, tone: state === 'scheduled' ? 'confirmed' : 'pending' }
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Earnings</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your pay</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Your lessons are paid together once a month, on the 3rd, for every lesson of the month before. Trial lessons are paid on their own, {REPORT_WINDOW_HOURS} hours
          after the lesson. If a problem is reported, that lesson waits until our team has looked into it.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {taxYears.map((year) => (
            <Link key={year} href={`/receipts/tax-year/${year}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800">
              <FileText className="h-4 w-4" aria-hidden="true" /> Yearly summary {taxYearLabel(year)}
            </Link>
          ))}
          <Link href="/teacher-terms" className="font-medium text-slate-600 hover:text-slate-900">
            How you&apos;re paid (terms)
          </Link>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CalendarClock className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Next payout · {shortDate(nextDay)}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{pounds(sum(nextPayout))}</p>
          <p className="mt-1 text-sm text-slate-500">
            {nextPayout.length} lesson{nextPayout.length === 1 ? '' : 's'} so far{later.length ? ` · then ${pounds(sum(later))} on ${shortDate(nextPayoutDate(new Date(nextDay.getTime() + 86_400_000)))}` : ''}
          </p>
        </Card>
        <Card>
          <Hourglass className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Trial lessons coming</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{pounds(sum(comingTrials))}</p>
          <p className="mt-1 text-sm text-slate-500">
            {comingTrials.length} trial{comingTrials.length === 1 ? '' : 's'}, paid {REPORT_WINDOW_HOURS} hours after the lesson
            {held.length ? ` · ${held.length} lesson${held.length === 1 ? '' : 's'} on hold (${pounds(sum(held))})` : ''}
          </p>
        </Card>
        <Card>
          <Banknote className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Paid out</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{pounds(paidOut)}</p>
          <p className="mt-1 text-sm text-slate-500">Sent to your bank to date</p>
        </Card>
      </div>

      <Card className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Monthly earnings</h2>
        <div className="mt-4">
          <EarningsTrendChart data={trendData} />
        </div>
      </Card>

      <Card className="mt-8 !p-0">
        <div className="p-6 pb-0">
          <h2 className="text-lg font-semibold text-slate-900">Monthly payouts</h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          {payouts?.length ? (
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3 font-semibold">Payout</th>
                  <th className="px-6 py-3 font-semibold">Lessons</th>
                  <th className="px-6 py-3 font-semibold">Amount</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Sent</th>
                  <th className="px-6 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((payout) => (
                  <tr key={payout.id} className="align-middle">
                    <td className="whitespace-nowrap px-6 py-3 font-medium text-slate-900">{payout.booking_id ? `Trial lesson · ${periodLabel(payout.period)}` : periodLabel(payout.period)}</td>
                    <td className="px-6 py-3 text-slate-700">{payout.lessons_count}</td>
                    <td className="whitespace-nowrap px-6 py-3 font-medium text-slate-900">{pounds(payout.amount)}</td>
                    <td className="whitespace-nowrap px-6 py-3" title={payout.failure_reason ?? undefined}>
                      <StatusBadge status={PAYOUT_STATUS[payout.status]?.tone ?? payout.status} label={PAYOUT_STATUS[payout.status]?.label ?? payout.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-slate-500">{payout.paid_at ? formatBookingDateTime(payout.paid_at) : '—'}</td>
                    <td className="whitespace-nowrap px-6 py-3">
                      <Link href={`/receipts/payout/${payout.id}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800">
                        <FileText className="h-4 w-4" aria-hidden="true" /> Statement
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-6 pb-6 text-slate-600">Your first payout will be on {shortDate(nextDay)}.</p>
          )}
        </div>
      </Card>

      <Card className="mt-8 !p-0">
        <div className="p-6 pb-0">
          <h2 className="text-lg font-semibold text-slate-900">Lessons</h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          {lessons.length ? (
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Student</th>
                  <th className="px-6 py-3 font-semibold">Lesson</th>
                  <th className="px-6 py-3 font-semibold">You earn</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lessons.map((lesson) => {
                  const status = lessonStatus(lesson)
                  return (
                    <tr key={lesson.id} className="align-middle transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-3 text-slate-700">{formatBookingDateTime(lesson.start_at)}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-slate-900">{students.get(lesson.student_id)?.name ?? 'Student'}</td>
                      <td className="px-6 py-3 text-slate-700">
                        {lesson.subject}
                        <span className="ml-2 text-xs text-slate-400">{lesson.is_trial ? 'Trial' : lesson.package_id ? 'Package' : ''}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 font-medium text-slate-900">{lesson.payout_amount != null ? pounds(lesson.payout_amount) : '—'}</td>
                      <td className="whitespace-nowrap px-6 py-3">
                        <StatusBadge status={status.tone} label={status.label} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="px-6 pb-6 text-slate-600">No lessons given yet.</p>
          )}
        </div>
      </Card>
    </main>
  )
}
