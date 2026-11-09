import { averageCriteria, type FeedbackRole } from '@/lib/sessionFeedback'

/** Average score per post-lesson criterion, as small bars (e.g. how a teacher rates a student's revision over time). */
export function CriteriaAverages({ role, scores, title }: { role: FeedbackRole; scores: (Record<string, number> | null | undefined)[]; title: string }) {
  const averages = averageCriteria(role, scores)
  if (!averages.length) return null
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title} · {Math.max(...averages.map((a) => a.count))} lesson{Math.max(...averages.map((a) => a.count)) === 1 ? '' : 's'}
      </p>
      <ul className="mt-3 space-y-2">
        {averages.map((a) => (
          <li key={a.key} className="grid grid-cols-[1fr_6rem_2.5rem] items-center gap-3 text-sm">
            <span className="text-slate-700">{a.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-slate-100">
              <span className={`block h-full rounded-full ${a.average >= 4 ? 'bg-emerald-500' : a.average >= 3 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${(a.average / 5) * 100}%` }} />
            </span>
            <span className="text-right font-medium text-slate-900">{a.average.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
