import { pounds } from '@/components/receipts/DocumentShell'
import type { StatementRow, statementTotals } from '@/lib/receipts'

const KIND = { trial: 'Trial', package: 'Package', lesson: 'Lesson' } as const

/** Lessons on a teacher's statement: what the student paid, the card fee, My Madrassa's share and the teacher's pay, with totals. */
export function StatementTable({ rows, totals }: { rows: StatementRow[]; totals: ReturnType<typeof statementTotals> }) {
  if (!rows.length) return <p className="text-slate-500">No lessons in this statement.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-slate-500">
            <th className="py-2 pr-2 font-semibold">Date</th>
            <th className="py-2 pr-2 font-semibold">Student</th>
            <th className="py-2 pr-2 font-semibold">Lesson</th>
            <th className="py-2 pr-2 text-right font-semibold">Student paid</th>
            <th className="py-2 pr-2 text-right font-semibold">Card fee</th>
            <th className="py-2 pr-2 text-right font-semibold">My Madrassa</th>
            <th className="py-2 text-right font-semibold">Your pay</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.bookingId} className="border-b border-slate-100">
              <td className="whitespace-nowrap py-2 pr-2">{new Date(row.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td className="py-2 pr-2">{row.studentName}</td>
              <td className="py-2 pr-2">
                {row.subject} <span className="text-slate-400">· {KIND[row.kind]}</span>
              </td>
              <td className="py-2 pr-2 text-right">{pounds(row.studentPaid)}</td>
              <td className="py-2 pr-2 text-right">{pounds(row.cardFee)}</td>
              <td className="py-2 pr-2 text-right">{pounds(row.platform)}</td>
              <td className="py-2 text-right font-medium text-slate-900">{pounds(row.teacherPay)}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-300 font-semibold text-slate-900">
            <td className="py-2" colSpan={3}>
              Total
            </td>
            <td className="py-2 pr-2 text-right">{pounds(totals.studentPaid)}</td>
            <td className="py-2 pr-2 text-right">{pounds(totals.cardFee)}</td>
            <td className="py-2 pr-2 text-right">{pounds(totals.platform)}</td>
            <td className="py-2 text-right">{pounds(totals.teacherPay)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">
        A package lesson shows one tenth of the package (its discounted price and card fee). The card fee is Stripe&apos;s real fee on the student&apos;s card and is
        paid by My Madrassa: your pay is always your full rate.
      </p>
    </div>
  )
}
