'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { TextArea } from '@/components/TextArea'
import { useToast } from '@/components/ToastProvider'
import type { ChangeField } from '@/lib/adminTeacherReview'

function showValue(field: string, value: unknown) {
  if (field === 'avatar_url') {
    // eslint-disable-next-line @next/next/no-img-element -- storage URL
    return value ? <img src={String(value)} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="text-slate-400">No photo</span>
  }
  if (Array.isArray(value)) return value.join(', ') || '—'
  return value ? String(value) : '—'
}

/** Before/after of a live teacher's submitted edits, with the decision. Approving replaces the live profile; rejecting returns the edits to the teacher with a note. */
export function AdminPendingChanges({ teacherId, changes }: { teacherId: string; changes: ChangeField[] }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  async function decide(action: 'approve' | 'reject') {
    if (action === 'reject' && !note.trim()) return showToast('error', 'Tell the teacher why these changes aren’t approved.')
    setBusy(action)
    const response = await fetch('/api/admin/teacher-changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId, action, note: action === 'reject' ? note.trim() : undefined }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) return showToast('error', result.error || 'Unable to save the decision.')
    showToast('success', action === 'approve' ? 'Changes approved and now live.' : 'Changes sent back to the teacher.')
    router.refresh()
  }

  return (
    <section className="space-y-3 rounded-3xl border border-amber-300 bg-amber-50/60 p-6">
      <div>
        <h2 className="text-lg font-semibold text-amber-900">Changes to review</h2>
        <p className="text-sm text-amber-800">The profile stays live as it is until you approve these.</p>
      </div>
      <ul className="space-y-3">
        {changes.map((change) => (
          <li key={change.field} className="rounded-xl bg-white p-3 text-sm">
            <p className="font-medium text-slate-900">{change.label}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Live now</p>
                <div className="mt-1 whitespace-pre-line text-slate-500">{showValue(change.field, change.before)}</div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-amber-700">Proposed</p>
                <div className="mt-1 whitespace-pre-line text-slate-900">{showValue(change.field, change.after)}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {rejecting ? (
        <TextArea label="Message to the teacher" name="changesNote" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {rejecting ? (
          <>
            <Button type="button" variant="secondary" onClick={() => setRejecting(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button type="button" onClick={() => decide('reject')} loading={busy === 'reject'} disabled={busy !== null}>
              Send back to the teacher
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
              Reject changes
            </Button>
            <Button type="button" onClick={() => decide('approve')} loading={busy === 'approve'} disabled={busy !== null}>
              Approve changes
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
