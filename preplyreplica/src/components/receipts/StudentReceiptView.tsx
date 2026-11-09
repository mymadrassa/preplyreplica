import { DocumentShell, StatusPill, pounds } from '@/components/receipts/DocumentShell'
import { companyDetails } from '@/lib/company'
import { CARD_REGION_LABELS, cardRegion, documentNumber, vatIncluded } from '@/lib/receipts'
import type { ReceiptDoc } from '@/lib/loadReceipts'

const STATUS = {
  paid: { tone: 'green', label: 'Paid' },
  refunded: { tone: 'red', label: 'Refunded' },
  on_hold: { tone: 'amber', label: 'Not charged yet' },
  not_charged: { tone: 'slate', label: 'Not charged' },
} as const

/** A student's receipt: what was bought, the price line by line, refunds, and where the money goes. */
export function StudentReceiptView({ doc, backHref }: { doc: ReceiptDoc; backHref: string }) {
  const company = companyDetails()
  const { receipt } = doc
  const status = STATUS[doc.status]
  const region = cardRegion(doc.cardCountry)
  const charged = doc.status === 'paid' || doc.status === 'refunded'

  return (
    <DocumentShell
      title="Receipt"
      number={documentNumber('R', doc.id)}
      date={doc.paidAt}
      backHref={backHref}
      badge={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Billed to</p>
          <p className="mt-1 font-medium text-slate-900">{doc.studentName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{doc.kind === 'trial' ? 'Trial lesson' : 'Lesson package'}</p>
          <p className="mt-1 text-slate-900">{doc.summary}</p>
          <p className="text-slate-500">Teacher: {doc.teacherName}</p>
        </div>
      </section>

      {!charged ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-amber-800">
          {doc.status === 'on_hold'
            ? `Your card is on hold for ${pounds(receipt.total)}, not charged yet: it's charged only when ${doc.teacherName} confirms the lesson. The receipt is complete once it's charged.`
            : 'This payment was never charged.'}
        </p>
      ) : null}

      <table className="w-full border-collapse">
        <tbody>
          {receipt.lines.map((line, i) => (
            <tr key={i} className={line.tone === 'total' || line.tone === 'net' ? 'border-t border-slate-300 font-semibold text-slate-900' : 'border-t border-slate-100'}>
              <td className="py-2 pr-4">
                {line.label}
                {line.detail ? <span className="block text-xs font-normal text-slate-500">{line.detail}</span> : null}
              </td>
              <td className={`whitespace-nowrap py-2 text-right ${line.tone === 'discount' || line.tone === 'refund' ? 'text-emerald-700' : ''}`}>{pounds(line.amount)}</td>
            </tr>
          ))}
          {company.vatNumber ? (
            <tr className="text-xs text-slate-500">
              <td className="py-1">Includes VAT at 20%</td>
              <td className="py-1 text-right">{pounds(vatIncluded(receipt.netPaid))}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <section className="rounded-2xl bg-slate-50 p-4">
        <p className="font-semibold text-slate-900">Where your money goes</p>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt>{doc.kind === 'package' ? 'Your teacher’s pay for the lessons' : 'Your teacher’s pay'}</dt>
          <dd className="text-right">{pounds(receipt.split.teacher)}</dd>
          <dt>
            Card processing fee (Stripe){region ? `, ${CARD_REGION_LABELS[region].toLowerCase()}` : ''}
            {receipt.split.cardFeeEstimated ? ' (estimate)' : ''}
          </dt>
          <dd className="text-right">{pounds(receipt.split.cardFee)}</dd>
          <dt>{company.name} (platform, booking and support)</dt>
          <dd className="text-right">{pounds(receipt.split.platform)}</dd>
        </dl>
        {doc.kind === 'package' ? (
          <p className="mt-2 text-xs text-slate-500">Your teacher is paid for each lesson once it&apos;s given. Unused lessons are refunded at the discounted price per lesson.</p>
        ) : null}
      </section>
    </DocumentShell>
  )
}
