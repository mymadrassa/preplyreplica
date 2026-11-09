'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'
import { TIERS, TIER_ORDER, type Tier } from '@/lib/pricing'

/** Admin override of a teacher's tier; "Automatic" hands it back to the daily promotion job. */
export function AdminTierSelect({ teacherId, tier, locked }: { teacherId: string; tier: Tier; locked: boolean }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [value, setValue] = useState<Tier | 'auto'>(locked ? tier : 'auto')
  const [saving, setSaving] = useState(false)

  async function change(next: Tier | 'auto') {
    const previous = value
    setValue(next)
    setSaving(true)
    const response = await fetch(`/api/admin/teachers/${teacherId}/tier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: next }),
    })
    setSaving(false)
    if (!response.ok) {
      setValue(previous)
      const result = await response.json().catch(() => ({}))
      return showToast('error', result.error || 'Unable to change the tier.')
    }
    showToast('success', next === 'auto' ? 'Tier is automatic again.' : `Tier set to ${TIERS[next].label}.`)
    router.refresh()
  }

  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Tier</span>
      <select
        value={value}
        disabled={saving}
        onChange={(event) => change(event.target.value as Tier | 'auto')}
        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
      >
        <option value="auto">Automatic (now {TIERS[tier].label})</option>
        {TIER_ORDER.map((t) => (
          <option key={t} value={t}>
            {TIERS[t].label} · £{TIERS[t].rate}/h, {Math.round(TIERS[t].commission * 100)}% (fixed)
          </option>
        ))}
      </select>
    </label>
  )
}
