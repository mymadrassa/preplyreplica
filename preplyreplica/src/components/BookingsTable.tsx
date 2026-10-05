import Link from 'next/link'
import { Avatar } from '@/components/Avatar'
import { StatusBadge } from '@/components/StatusBadge'
import { BOOKING_STATUS_LABELS, formatBookingDateTime } from '@/lib/format'

export interface BookingRow {
  id: string
  subject: string
  startAt: string
  status: string
  counterpartName: string | null
  counterpartAvatarUrl?: string | null
  counterpartHref?: string
  isTrial?: boolean
}

interface BookingsTableProps {
  rows: BookingRow[]
  counterpartLabel: string
  renderActions: (row: BookingRow) => React.ReactNode
  emptyMessage: string
}

export function BookingsTable({ rows, counterpartLabel, renderActions, emptyMessage }: BookingsTableProps) {
  if (!rows.length) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
      <table className="min-w-[720px] w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-semibold">{counterpartLabel}</th>
            <th className="px-4 py-3 font-semibold">Subject</th>
            <th className="px-4 py-3 font-semibold">Date &amp; time</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="align-middle transition-colors hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3">
                {row.counterpartHref ? (
                  <Link href={row.counterpartHref} className="flex items-center gap-2.5 hover:opacity-80">
                    <Avatar name={row.counterpartName} avatarUrl={row.counterpartAvatarUrl} />
                    <span className="font-medium text-slate-900">{row.counterpartName ?? counterpartLabel}</span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-2.5">
                    <Avatar name={row.counterpartName} avatarUrl={row.counterpartAvatarUrl} />
                    <span className="font-medium text-slate-900">{row.counterpartName ?? counterpartLabel}</span>
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-700">
                <span className="flex items-center gap-2">
                  {row.subject}
                  {row.isTrial ? <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">Trial</span> : null}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatBookingDateTime(row.startAt)}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={row.status} label={BOOKING_STATUS_LABELS[row.status] ?? row.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-3">{renderActions(row)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
