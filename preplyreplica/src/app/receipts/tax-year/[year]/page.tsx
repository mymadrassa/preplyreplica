import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadTaxYearSummary } from '@/lib/loadReceipts'
import { DocumentShell, pounds } from '@/components/receipts/DocumentShell'
import { StatementTable } from '@/components/receipts/StatementTable'
import { taxYearLabel, taxYearRange } from '@/lib/receipts'
import { periodLabel } from '@/lib/payouts'

export const metadata = { title: 'Yearly summary · My Madrassa' }

/**
 * A teacher's earnings for one UK tax year (6 April to 5 April), for their
 * Self Assessment: every payout sent in it and the lessons it paid. An admin
 * can open a teacher's with ?teacher=<id>.
 */
export default async function TaxYearSummaryPage({ params, searchParams }: { params: { year: string }; searchParams: { teacher?: string } }) {
  const supabase = createServerClient()
  const userId = (await supabase.auth.getSession()).data?.session?.user?.id
  if (!userId) redirect(`/auth/login?next=/receipts/tax-year/${params.year}`)
  const startYear = Number(params.year)
  if (!Number.isInteger(startYear) || startYear < 2020 || startYear > 2100) notFound()
  const summary = await loadTaxYearSummary(searchParams.teacher || userId, startYear, userId)
  if (!summary) notFound()
  const { start, end } = taxYearRange(startYear)
  const lastDay = new Date(end.getTime() - 86_400_000)

  return (
    <DocumentShell title={`Earnings ${taxYearLabel(startYear)}`} number={`Tax year ${taxYearLabel(startYear)}`} date={null} backHref="/teacher/earnings">
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Teacher</p>
          <p className="mt-1 font-medium text-slate-900">{summary.teacherName}</p>
          <p className="text-slate-500">Independent teacher</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Period</p>
          <p className="mt-1 text-slate-900">
            {start.toLocaleDateString('en-GB', { dateStyle: 'long', timeZone: 'UTC' })} to {lastDay.toLocaleDateString('en-GB', { dateStyle: 'long', timeZone: 'UTC' })}
          </p>
          <p className="text-slate-500">Payouts sent in this period</p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        {[
          ['Paid to you', pounds(summary.paidOut)],
          ['Lessons', String(summary.rows.length)],
          ['Payouts', String(summary.payouts.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-lg font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section>
        <p className="mb-2 font-semibold text-slate-900">Payouts</p>
        {summary.payouts.length ? (
          <ul className="divide-y divide-slate-100">
            {summary.payouts.map((p) => (
              <li key={p.id} className="flex justify-between py-1.5">
                <span>
                  {new Date(p.paidAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })} · {p.isTrial ? 'Trial lesson' : `Lessons of ${periodLabel(p.period)}`} ({p.lessonsCount})
                </span>
                <span className="font-medium text-slate-900">{pounds(p.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">No payouts in this tax year.</p>
        )}
      </section>

      <section>
        <p className="mb-2 font-semibold text-slate-900">Lessons</p>
        <StatementTable rows={summary.rows} totals={summary.totals} />
      </section>

      <p className="text-xs text-slate-500">
        You&apos;re self-employed: report this income on your Self Assessment tax return. This summary is for your records; keep it with your payout statements.
      </p>
    </DocumentShell>
  )
}
