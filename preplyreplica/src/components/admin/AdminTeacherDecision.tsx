'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Sparkles, XCircle } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextArea } from '@/components/TextArea'
import { COMMON_REJECTION_REASONS, addReasonLine } from '@/lib/reviewMessage'
import { useToast } from '@/components/ToastProvider'

type Action = 'approve' | 'reject' | 'suspend' | 'reset'

interface AdminTeacherDecisionProps {
  teacherId: string
  status: string
  /** Why approving isn't possible yet (missing steps, suspicious files); empty when it is. */
  blockers: string[]
  /** What's missing, as a ready-to-send message ('' when nothing is). */
  automaticMessage: string
  /** The message sent with the last decision, if any. */
  lastNote: string | null
}

/**
 * The admin's decision on a teacher's profile. Not approving always comes with
 * a message to the teacher: the automatic one (what's missing), edited, or the
 * admin's own words. It's saved on the profile and emailed.
 */
export function AdminTeacherDecision({ teacherId, status, blockers, automaticMessage, lastNote }: AdminTeacherDecisionProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [busy, setBusy] = useState<Action | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [message, setMessage] = useState(automaticMessage)

  async function decide(action: Action, note?: string) {
    setBusy(action)
    const response = await fetch('/api/teacher/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId, action, note }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) return showToast('error', result.error || 'Unable to save the decision.')
    showToast(
      'success',
      action === 'approve' ? 'Teacher approved. They’ve been emailed.' : action === 'reject' ? 'Not approved. The teacher has been emailed your message.' : 'Status updated.'
    )
    setRejecting(false)
    router.refresh()
  }

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="text-lg font-semibold text-slate-900">Decision</h2>

      {lastNote && status !== 'approved' ? (
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Last message sent</p>
          <p className="mt-1 whitespace-pre-line">{lastNote}</p>
        </div>
      ) : null}

      {blockers.length && status !== 'approved' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Can’t be approved yet:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rejecting ? (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/40 p-4">
          <p className="text-sm text-slate-700">
            {automaticMessage
              ? 'Pre-filled with what this profile is missing. Send it as is, edit it, or add a reason below.'
              : 'Nothing is missing on this profile, so there’s no automatic message: write the reason, or pick common reasons below.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMON_REJECTION_REASONS.map((reason) => (
              <button
                key={reason.label}
                type="button"
                onClick={() => setMessage((current) => addReasonLine(current, reason.line))}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700"
              >
                + {reason.label}
              </button>
            ))}
          </div>
          <TextArea
            label="Message to the teacher (emailed, and shown on their profile)"
            name="reviewNote"
            rows={6}
            maxLength={2000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={'e.g. Please make the following changes, then submit your profile again:\n• Your ID photo is blurry: please upload a clearer one.'}
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {automaticMessage ? (
              <button type="button" onClick={() => setMessage(automaticMessage)} className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:text-brand-800">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Use the automatic message
              </button>
            ) : null}
            {message ? (
              <button type="button" onClick={() => setMessage('')} className="font-medium text-slate-500 hover:text-slate-700">
                Clear and write my own
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRejecting(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button type="button" onClick={() => decide('reject', message.trim())} loading={busy === 'reject'} disabled={busy !== null || !message.trim()}>
              <XCircle className="h-4 w-4" aria-hidden="true" /> Send and don’t approve
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status !== 'approved' ? (
            <Button type="button" onClick={() => decide('approve')} loading={busy === 'approve'} disabled={busy !== null || blockers.length > 0}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve
            </Button>
          ) : null}
          {status !== 'rejected' ? (
            <Button type="button" variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
              <XCircle className="h-4 w-4" aria-hidden="true" /> {status === 'approved' ? 'Withdraw approval…' : 'Reject…'}
            </Button>
          ) : null}
          {status === 'approved' ? (
            <Button type="button" variant="secondary" onClick={() => decide('suspend')} loading={busy === 'suspend'} disabled={busy !== null}>
              Suspend
            </Button>
          ) : null}
          {status === 'suspended' || status === 'rejected' ? (
            <Button type="button" variant="secondary" onClick={() => decide('reset')} loading={busy === 'reset'} disabled={busy !== null}>
              Set back to pending
            </Button>
          ) : null}
        </div>
      )}
    </section>
  )
}
