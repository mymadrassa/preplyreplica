'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/Button'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/ToastProvider'
import { Avatar } from '@/components/Avatar'

type Action = 'approve' | 'reject' | 'suspend' | 'reset'

const STATUS_OPTIONS: Array<{ action: Action; label: string; status: string; variant: 'primary' | 'secondary' }> = [
  { action: 'approve', label: 'Approve', status: 'approved', variant: 'primary' },
  { action: 'reject', label: 'Reject', status: 'rejected', variant: 'secondary' },
  { action: 'suspend', label: 'Suspend', status: 'suspended', variant: 'secondary' },
  { action: 'reset', label: 'Set to pending', status: 'pending', variant: 'secondary' },
]

interface AdminTeacherDetailModalProps {
  teacherId: string
  name: string
  email: string | null
  avatarUrl: string | null
  headline: string | null
  bio: string | null
  subjects: string[]
  languages: string[]
  hourlyRate: number
  stripeChargesEnabled: boolean
  videoUrl: string | null
  documentUrls: { name: string; url: string; kind?: 'identity' | 'certificate'; reviewChange?: 'add' | 'remove' | null }[]
  status: string
  createdAt: string | null
  /** Submitted edits to a live profile, waiting for a decision. */
  pendingChanges?: { field: string; label: string; before: unknown; after: unknown }[] | null
  onClose: () => void
}

/** Full teacher review surface — everything AdminTeacherCard used to show inline, now a centered modal opened from the teachers table (same shell pattern as BookingDetailModal). */
export function AdminTeacherDetailModal({
  teacherId,
  name,
  email,
  avatarUrl,
  headline,
  bio,
  subjects,
  languages,
  hourlyRate,
  stripeChargesEnabled,
  videoUrl,
  documentUrls,
  status: initialStatus,
  createdAt,
  pendingChanges,
  onClose,
}: AdminTeacherDetailModalProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [status, setStatus] = useState(initialStatus)
  const [pendingAction, setPendingAction] = useState<Action | null>(null)

  async function handleAction(action: Action) {
    setPendingAction(action)
    const response = await fetch('/api/teacher/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId, action }),
    })
    const result = await response.json()
    setPendingAction(null)
    if (!response.ok) {
      showToast('error', result.error || 'Unable to update status')
      return
    }
    setStatus(STATUS_OPTIONS.find((option) => option.action === action)!.status)
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={name} avatarUrl={avatarUrl} size="md" />
            <div>
              <p className="text-lg font-semibold text-slate-900">{name}</p>
              <p className="text-sm text-slate-500">{email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm text-slate-700">Submitted {createdAt ? new Date(createdAt).toLocaleDateString('en-GB') : 'unknown date'}</p>
          <StatusBadge status={status} />
        </div>

        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Headline</p>
            <p className="mt-1">{headline || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Bio</p>
            <p className="mt-1">{bio || '—'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Subjects</p>
              <p className="mt-1">{subjects.length ? subjects.join(', ') : '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Languages</p>
              <p className="mt-1">{languages.length ? languages.join(', ') : '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Hourly rate</p>
              <p className="mt-1">£{hourlyRate}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Stripe payouts</p>
              <p className="mt-1">{stripeChargesEnabled ? 'Enabled' : 'Not completed yet'}</p>
            </div>
          </div>
          {videoUrl ? (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Intro video</p>
              <a href={videoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-brand-600 underline">
                {videoUrl}
              </a>
            </div>
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Verification documents</p>
            {documentUrls.length ? (
              <ul className="mt-1 space-y-1">
                {documentUrls.map((doc, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${doc.kind === 'certificate' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                      {doc.kind === 'certificate' ? 'Certificate' : 'ID'}
                    </span>
                    {doc.reviewChange === 'add' ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">New · to review</span>
                    ) : doc.reviewChange === 'remove' ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Removed if approved</span>
                    ) : null}
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                        {doc.name}
                      </a>
                    ) : (
                      doc.name
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-slate-500">None uploaded.</p>
            )}
          </div>
        </div>

        {pendingChanges?.length ? <PendingChangesReview teacherId={teacherId} changes={pendingChanges} onDone={onClose} /> : null}

        <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
          {STATUS_OPTIONS.filter((option) => option.status !== status).map((option) => (
            <Button
              key={option.action}
              type="button"
              variant={option.variant}
              onClick={() => handleAction(option.action)}
              loading={pendingAction === option.action}
              disabled={pendingAction !== null}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

function showValue(field: string, value: unknown) {
  if (field === 'avatar_url') {
    // eslint-disable-next-line @next/next/no-img-element -- storage URL
    return value ? <img src={String(value)} alt="" className="h-16 w-16 rounded-full object-cover" /> : <span className="text-slate-400">No photo</span>
  }
  if (Array.isArray(value)) return value.join(', ') || '—'
  return value ? String(value) : '—'
}

/** Before/after of a live teacher's submitted edits, with the decision. Approving replaces the live profile; rejecting returns the edits to the teacher with a note. */
function PendingChangesReview({ teacherId, changes, onDone }: { teacherId: string; changes: { field: string; label: string; before: unknown; after: unknown }[]; onDone: () => void }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)

  async function decide(action: 'approve' | 'reject') {
    let note: string | undefined
    if (action === 'reject') {
      const answer = window.prompt('Why are these changes not approved? The teacher will see this note.')
      if (answer === null) return
      note = answer
    }
    setBusy(action)
    const response = await fetch('/api/admin/teacher-changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId, action, note }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) return showToast('error', result.error || 'Unable to save the decision.')
    showToast('success', action === 'approve' ? 'Changes approved and now live.' : 'Changes sent back to the teacher.')
    router.refresh()
    onDone()
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
      <p className="text-sm font-semibold text-amber-900">Changes to review</p>
      <p className="text-xs text-amber-800">The profile stays live as it is until you approve these.</p>
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => decide('reject')} loading={busy === 'reject'} disabled={busy !== null}>
          Reject changes
        </Button>
        <Button type="button" onClick={() => decide('approve')} loading={busy === 'approve'} disabled={busy !== null}>
          Approve changes
        </Button>
      </div>
    </section>
  )
}
