import { TIERS, TIER_ORDER, packagePrice, type Tier } from '@/lib/pricing'

/** How the teacher's rate is set: by tier, with what each tier needs and what students pay. */
export function TierRates({ current = 'starter' }: { current?: Tier }) {
  const criteria = (tier: Tier) => {
    const rule = TIERS[tier]
    if (!rule.minLessons) return 'New teachers'
    const parts = [`${rule.minMonths} months`, `${rule.minLessons}+ lessons`, `${rule.minRating}+ rating`]
    if (rule.minRetention) parts.push('returning students')
    return parts.join(', ')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Tier</th>
            <th className="px-3 py-2">You receive</th>
            <th className="hidden px-3 py-2 sm:table-cell">To reach it</th>
            <th className="px-3 py-2">Students pay</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {TIER_ORDER.map((tier) => (
            <tr key={tier} className={tier === current ? 'bg-brand-50/60' : ''}>
              <td className="px-3 py-2 font-medium text-slate-900">
                {TIERS[tier].label}
                {tier === current ? <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 text-[10px] font-semibold uppercase text-brand-700">You</span> : null}
              </td>
              <td className="px-3 py-2 font-semibold text-slate-900">£{TIERS[tier].rate.toFixed(2)}/h</td>
              <td className="hidden px-3 py-2 text-slate-600 sm:table-cell">{criteria(tier)}</td>
              <td className="px-3 py-2 text-slate-600">£{packagePrice(tier).perLesson.toFixed(2)}/lesson</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
