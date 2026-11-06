import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown, ShieldAlert } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { StatusBadge } from '@/components/StatusBadge'
import { ClickableRow } from '@/components/admin/ClickableRow'
import { toPounds } from '@/lib/pricing'

export interface AdminTeacherRow {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
  status: string
  createdAt: string | null
  awaitingPayoutPence: number
  paidOutPence: number
  /** Submitted edits to a live profile wait for the admin. */
  hasPendingChanges: boolean
  /** Documents that failed the safety check: the admin is warned right in the list. */
  suspiciousDocuments: number
  /** The teacher wrote in their Admin conversation since an admin last opened it. */
  hasUnreadReply: boolean
}

type SortBy = 'name' | 'created_at' | 'status'
type SortDir = 'asc' | 'desc'

interface AdminTeachersTableProps {
  rows: AdminTeacherRow[]
  page: number
  pageSize: number
  totalCount: number
  sortBy: SortBy
  sortDir: SortDir
  /** Current query params (q/status/from/to) to preserve across sort and pagination links. */
  currentParams: Record<string, string | undefined>
}

const SORT_COLUMNS: Array<{ key: SortBy; label: string }> = [
  { key: 'name', label: 'Teacher' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Registered' },
]

function buildHref(currentParams: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  const merged = { ...currentParams, ...overrides }
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return `/admin/dashboard${query ? `?${query}` : ''}`
}

export function AdminTeachersTable({ rows, page, pageSize, totalCount, sortBy, sortDir, currentParams }: AdminTeachersTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  if (!rows.length) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No teachers match your filters.</p>
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {SORT_COLUMNS.map((column) => {
                const isActive = sortBy === column.key
                const nextDir: SortDir = isActive && sortDir === 'asc' ? 'desc' : 'asc'
                const Icon = isActive ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
                return (
                  <th key={column.key} className="px-4 py-3 font-semibold">
                    <Link href={buildHref(currentParams, { sortBy: column.key, sortDir: nextDir, page: undefined })} className="inline-flex items-center gap-1.5 hover:text-slate-700">
                      {column.label}
                      <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} aria-hidden="true" />
                    </Link>
                  </th>
                )
              })}
              <th className="px-4 py-3 font-semibold">Payment status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <ClickableRow key={row.id} href={`/admin/teachers/${row.id}`} className="align-middle transition-colors hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={row.name} avatarUrl={row.avatarUrl} />
                    <span>
                      <span className="block font-medium text-slate-900">{row.name}</span>
                      <span className="block text-xs text-slate-500">{row.email}</span>
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={row.status} />
                    {row.hasPendingChanges ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Changes to review</span>
                    ) : null}
                    {row.hasUnreadReply ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">New reply</span>
                    ) : null}
                    {row.suspiciousDocuments ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
                        <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Suspicious file
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {row.awaitingPayoutPence || row.paidOutPence ? (
                    <span className="space-y-0.5">
                      {row.awaitingPayoutPence ? <span className="block font-medium text-amber-700">£{toPounds(row.awaitingPayoutPence).toFixed(2)} awaiting</span> : null}
                      {row.paidOutPence ? <span className="block text-slate-500">£{toPounds(row.paidOutPence).toFixed(2)} paid out</span> : null}
                    </span>
                  ) : (
                    <span className="text-slate-400">No payments yet</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/teachers/${row.id}`}
                    className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-white"
                  >
                    View profile
                  </Link>
                </td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p>
          {start}–{end} of {totalCount}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={buildHref(currentParams, { page: String(Math.max(1, page - 1)) })}
            aria-disabled={page <= 1}
            className={`rounded-full border px-3 py-1.5 font-medium ${page <= 1 ? 'pointer-events-none border-slate-200 text-slate-300' : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-white'}`}
          >
            Previous
          </Link>
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={buildHref(currentParams, { page: String(Math.min(totalPages, page + 1)) })}
            aria-disabled={page >= totalPages}
            className={`rounded-full border px-3 py-1.5 font-medium ${page >= totalPages ? 'pointer-events-none border-slate-200 text-slate-300' : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-white'}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  )
}
