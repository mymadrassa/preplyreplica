// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/StatusBadge.tsx
const colorMap: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  completed: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  cancelled: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  suspended: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
}

const dotColorMap: Record<string, string> = {
  approved: 'bg-emerald-500',
  confirmed: 'bg-emerald-500',
  completed: 'bg-brand-500',
  pending: 'bg-amber-500',
  rejected: 'bg-red-500',
  cancelled: 'bg-red-500',
  suspended: 'bg-slate-400',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${colorMap[status] ?? 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColorMap[status] ?? 'bg-slate-400'}`} aria-hidden="true" />
      {status}
    </span>
  )
}
