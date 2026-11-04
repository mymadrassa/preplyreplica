import { TrendingUp } from 'lucide-react'
import { Card } from '@/components/Card'
import { TIERS, packagePrice, type Tier } from '@/lib/pricing'
import type { TierProgress as Progress } from '@/lib/tiers'

/** The teacher's tier, what students pay them at it, and how far the next tier is. */
export function TierProgress({ tier, rate, progress, locked }: { tier: Tier; rate: number; progress: Progress | null; locked: boolean }) {
  const rule = TIERS[tier]
  const price = packagePrice(rate, tier)
  return (
    <Card>
      <TrendingUp className="h-5 w-5 text-brand-600" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Your tier</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">
        {rule.label} <span className="text-base font-normal text-slate-500">· {Math.round(rule.commission * 100)}% commission</span>
      </p>
      <p className="mt-1 text-sm text-slate-600">
        You receive £{rate.toFixed(2)} per lesson; students pay £{price.perLesson.toFixed(2)} a lesson in their package.
      </p>
      {progress && !locked ? (
        <div className="mt-4">
          <div className="flex justify-between text-xs font-medium text-slate-600">
            <span>Next: {TIERS[progress.next].label} ({Math.round(TIERS[progress.next].commission * 100)}% commission)</span>
            <span>{Math.round(progress.ratio * 100)}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(progress.ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </div>
          {progress.missing.length ? (
            <p className="mt-2 text-sm text-slate-600">
              {progress.missing[0]} to reach {TIERS[progress.next].label}
              {progress.missing.length > 1 ? <span className="block text-xs text-slate-400">Also needed: {progress.missing.slice(1).join(', ')}</span> : null}
            </p>
          ) : (
            <p className="mt-2 text-sm text-emerald-700">You qualify: your promotion is applied within a day.</p>
          )}
        </div>
      ) : progress === null ? (
        <p className="mt-4 text-sm text-emerald-700">You&apos;re at the top tier. Thank you for your teaching!</p>
      ) : null}
    </Card>
  )
}
