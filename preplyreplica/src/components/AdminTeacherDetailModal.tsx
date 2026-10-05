'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/Button'
import { StatusBadge } from '@/components/StatusBadge'
import { FormMessage } from '@/components/FormMessage'
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
  documentUrls: { name: string; url: string }[]
  status: string
  createdAt: string | null
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
  onClose,
}: AdminTeacherDetailModalProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [pendingAction, setPendingAction] = useState<Action | null>(null)
  const [error, setError] = useState('')

  async function handleAction(action: Action) {
    setError('')
    setPendingAction(action)
    const response = await fetch('/api/teacher/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId, action }),
    })
    const result = await response.json()
    setPendingAction(null)
    if (!response.ok) {
      setError(result.error || 'Unable to update status')
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
                  <li key={index}>
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
        {error ? <FormMessage type="error">{error}</FormMessage> : null}
      </div>
    </div>
  )
}
