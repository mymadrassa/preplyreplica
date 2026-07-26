// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/StatusBadge.tsx
const colorMap: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-slate-100 text-slate-700',
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${colorMap[status] ?? 'bg-slate-100 text-slate-700'}`}>{status}</span>
}
