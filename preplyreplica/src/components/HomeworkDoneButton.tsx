'use client'

import { useState } from 'react'
import { Check, Undo2 } from 'lucide-react'
import { useToast } from '@/components/ToastProvider'

/**
 * The student's "mark as done" (round check) or "undo" for one lesson's homework.
 * Optimistic: `onChange` fires at once with the new done date and again with
 * the previous one if saving fails.
 */
export function HomeworkDoneButton({ id, doneAt, onChange }: { id: string; doneAt: string | null; onChange: (doneAt: string | null) => void }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const done = !!doneAt

  async function toggle() {
    const previous = doneAt
    setBusy(true)
    onChange(done ? null : new Date().toISOString())
    const response = await fetch(`/api/homework/${id}/done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done }),
    })
    setBusy(false)
    if (!response.ok) {
      onChange(previous)
      const result = await response.json().catch(() => ({}))
      return showToast('error', result.error || 'Unable to update the homework.')
    }
    showToast('success', done ? 'Moved back to your to-do.' : 'Well done! Your teacher has been told.')
  }

  if (done) {
    return (
      <button type="button" onClick={toggle} disabled={busy} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50">
        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Undo
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title="Mark as done"
      aria-label="Mark as done"
      className="group flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 text-emerald-600 transition-colors hover:bg-emerald-500 hover:text-white disabled:opacity-50"
    >
      <Check className="h-4 w-4 opacity-40 group-hover:opacity-100" aria-hidden="true" />
    </button>
  )
}
