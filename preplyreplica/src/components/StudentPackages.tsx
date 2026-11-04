'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Package } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/ToastProvider'

export interface StudentPackageRow {
  id: string
  teacherId: string
  teacherName: string
  lessonsLeft: number
  lessonsTotal: number
  /** Pounds per unused lesson. */
  refundPerLesson: number
  expiresAt: string | null
}

/** The student's active packages: lessons left, expiry, and cancel with a refund of unused lessons. */
export function StudentPackages({ packages }: { packages: StudentPackageRow[] }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState<StudentPackageRow | null>(null)
  const [busy, setBusy] = useState(false)

  async function cancel(pkg: StudentPackageRow) {
    setBusy(true)
    const response = await fetch(`/api/packages/${pkg.id}/cancel`, { method: 'POST' })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    setConfirming(null)
    if (!response.ok) return showToast('error', result.error || 'Unable to cancel the package.')
    showToast('success', `Package cancelled. £${((result.refunded ?? 0) / 100).toFixed(2)} is on its way back to your card.`)
    router.refresh()
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Your packages</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {packages.map((pkg) => (
          <li key={pkg.id} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-card">
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              <Package className="h-4 w-4 text-emerald-600" aria-hidden="true" /> {pkg.teacherName}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              <strong>{pkg.lessonsLeft}</strong> of {pkg.lessonsTotal} lessons left
              {pkg.expiresAt ? ` · valid until ${new Date(pkg.expiresAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {pkg.lessonsLeft ? (
                <Link href={`/teachers/${pkg.teacherId}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                  Book a lesson
                </Link>
              ) : null}
              {pkg.lessonsLeft ? (
                <button type="button" onClick={() => setConfirming(pkg)} className="text-sm font-medium text-slate-500 hover:text-red-700">
                  Cancel and refund
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setConfirming(null)} />
          <div role="alertdialog" aria-modal="true" className="relative z-10 w-full max-w-sm space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">Cancel your package with {confirming.teacherName}?</h3>
            <p className="text-sm text-slate-600">
              Your {confirming.lessonsLeft} unused lesson{confirming.lessonsLeft === 1 ? '' : 's'} will be refunded (£
              {(confirming.lessonsLeft * confirming.refundPerLesson).toFixed(2)}). Lessons you&apos;ve already booked still go ahead.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfirming(null)} disabled={busy}>
                Keep it
              </Button>
              <Button type="button" onClick={() => cancel(confirming)} loading={busy}>
                Cancel and refund
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
