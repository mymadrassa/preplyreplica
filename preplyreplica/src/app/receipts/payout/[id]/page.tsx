import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadPayoutStatement } from '@/lib/loadReceipts'
import { DocumentShell, StatusPill, pounds } from '@/components/receipts/DocumentShell'
import { StatementTable } from '@/components/receipts/StatementTable'
import { documentNumber } from '@/lib/receipts'
import { periodLabel } from '@/lib/payouts'

export const metadata = { title: 'Payout statement · My Madrassa' }

const STATUS = { paid: { tone: 'green', label: 'Paid' }, pending: { tone: 'amber', label: 'Sending' }, failed: { tone: 'red', label: 'Retrying' } } as const

/** A teacher's statement for one payout: every lesson it pays, with each fee. */
export default async function PayoutStatementPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const userId = (await supabase.auth.getSession()).data?.session?.user?.id
  if (!userId) redirect(`/auth/login?next=/receipts/payout/${params.id}`)
  const statement = await loadPayoutStatement(params.id, userId)
  if (!statement) notFound()
  const { payout } = statement
  const status = STATUS[payout.status as keyof typeof STATUS] ?? STATUS.pending

  return (
    <DocumentShell
      title="Payout statement"
      number={documentNumber('P', payout.id)}
      date={payout.paidAt}
      backHref="/teacher/earnings"
      badge={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Paid to</p>
          <p className="mt-1 font-medium text-slate-900">{statement.teacherName}</p>
          <p className="text-slate-500">Independent teacher</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">For</p>
          <p className="mt-1 text-slate-900">{payout.isTrial ? 'A trial lesson (paid 48 hours after the lesson)' : `Lessons given in ${periodLabel(payout.period)}`}</p>
          <p className="text-slate-500">
            {payout.lessonsCount} lesson{payout.lessonsCount === 1 ? '' : 's'} · <strong className="text-slate-900">{pounds(payout.amount)}</strong>
          </p>
        </div>
      </section>

      <StatementTable rows={statement.rows} totals={statement.totals} />

      <section className="rounded-2xl bg-slate-50 p-4">
        <p className="font-semibold text-slate-900">How it was sent</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>My Madrassa transferred your pay to your Stripe account{payout.transferId ? ` (ref ${payout.transferId})` : ''}.</li>
          <li>Stripe paid it out to your bank account{payout.payoutId ? ` (ref ${payout.payoutId})` : ''}. It usually arrives within a few working days.</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">You&apos;re self-employed: this income goes on your Self Assessment tax return. Your yearly summary is on the Earnings page.</p>
      </section>
    </DocumentShell>
  )
}
