'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { TextArea } from '@/components/TextArea'
import { useToast } from '@/components/ToastProvider'
import type { ReportResolution } from '@/types/database'

/** The admin's decision on a reported lesson; both sides get it, with the note, in their Admin conversation. */
export function ResolveReportForm({ bookingId, isPackage, paidPence }: { bookingId: string; isPackage: boolean; paidPence: number | null }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [resolution, setResolution] = useState<ReportResolution | null>(null)
  const [pounds, setPounds] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const options: { value: ReportResolution; label: string; hint: string }[] = [
    { value: 'pay_teacher', label: 'Pay the teacher', hint: 'The lesson counts as given; paid with the next payout (a trial: within a day).' },
    {
      value: 'refund_student',
      label: isPackage ? 'Give the lesson back to the student' : 'Refund the student in full',
      hint: isPackage ? 'The lesson returns to their package; the teacher isn’t paid for it.' : 'Their card is refunded; the teacher isn’t paid for it.',
    },
    ...(isPackage || paidPence == null
      ? []
      : [{ value: 'refund_partial' as const, label: 'Refund part of it', hint: 'The teacher is paid the rest of their share.' }]),
  ]

  async function submit() {
    if (!resolution) return showToast('error', 'Choose a decision.')
    const refundAmount = resolution === 'refund_partial' ? Math.round(Number(pounds.replace(',', '.')) * 100) : undefined
    if (resolution === 'refund_partial' && !(refundAmount && refundAmount > 0)) return showToast('error', 'Enter the amount to refund.')
    setBusy(true)
    const response = await fetch(`/api/admin/reports/${bookingId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, refundAmount, note: note.trim() || undefined }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) return showToast('error', result.error || 'Unable to save the decision.')
    showToast('success', 'Decision saved. Both sides have been told in their messages.')
    router.refresh()
  }

  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div role="radiogroup" aria-label="Decision" className="space-y-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={resolution === option.value}
            onClick={() => setResolution(option.value)}
            className={`block w-full rounded-2xl border p-3 text-left transition-colors ${resolution === option.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
          >
            <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
            <span className="block text-xs text-slate-500">{option.hint}</span>
          </button>
        ))}
      </div>
      {resolution === 'refund_partial' && paidPence != null ? (
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Amount to refund (£, out of £{(paidPence / 100).toFixed(2)})</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={(paidPence - 1) / 100}
            value={pounds}
            onChange={(event) => setPounds(event.target.value)}
            className="mt-1 block w-40 rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none"
          />
        </label>
      ) : null}
      <TextArea label="Note to both sides (optional)" name="note" rows={3} maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="flex justify-end">
        <Button type="button" onClick={submit} loading={busy} disabled={busy}>
          Save decision
        </Button>
      </div>
    </div>
  )
}
