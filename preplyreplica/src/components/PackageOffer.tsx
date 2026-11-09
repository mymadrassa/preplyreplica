'use client'

import { useState } from 'react'
import { Package } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/ToastProvider'
import { PACKAGE, type PackagePrice } from '@/lib/pricing'

/** "10 lessons, save 10%": bought upfront, booked one at a time from the booking form. */
export function PackageOffer({ teacherId, teacherName, pricing, highlight = false }: { teacherId: string; teacherName: string; pricing: PackagePrice; highlight?: boolean }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  async function buy() {
    setLoading(true)
    const response = await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      setLoading(false)
      return showToast('error', result.error || 'Unable to start checkout.')
    }
    window.location.href = result.checkoutUrl
  }

  return (
    <div id="package" className={`space-y-3 rounded-3xl border p-6 ${highlight ? 'border-emerald-400 bg-emerald-50 shadow-card' : 'border-slate-200 bg-white'}`}>
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
        <Package className="h-4 w-4" aria-hidden="true" /> {pricing.lessons}-lesson package
      </p>
      <p className="text-3xl font-semibold text-slate-900">
        £{pricing.price.toFixed(2)} <span className="text-base font-normal text-slate-400 line-through">£{pricing.normalPrice.toFixed(2)}</span>
      </p>
      <p className="text-sm text-slate-600">
        Save {Math.round(PACKAGE.discount * 100)}% (£{pricing.savings.toFixed(2)}) on {pricing.lessons} one-hour lessons with {teacherName}: £{pricing.perLesson.toFixed(2)} a lesson. Use them
        within {PACKAGE.validityMonths} months; unused lessons are refunded.
      </p>
      <p className="text-xs text-slate-500">
        Paid to My Madrassa, with a receipt showing every fee.{' '}
        <a href="/terms" target="_blank" className="font-medium text-brand-700 underline">
          Terms
        </a>
      </p>
      <Button type="button" onClick={buy} loading={loading} className="w-full">
        Buy {pricing.lessons} lessons
      </Button>
    </div>
  )
}
