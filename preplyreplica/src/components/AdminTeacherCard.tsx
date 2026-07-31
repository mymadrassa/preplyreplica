'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { Button } from '@/components/Button'
import { StatusBadge } from '@/components/StatusBadge'
import { FormMessage } from '@/components/FormMessage'

type Action = 'approve' | 'reject' | 'suspend' | 'reset'

const STATUS_OPTIONS: Array<{ action: Action; label: string; status: string; variant: 'primary' | 'secondary' }> = [
  { action: 'approve', label: 'Approve', status: 'approved', variant: 'primary' },
  { action: 'reject', label: 'Reject', status: 'rejected', variant: 'secondary' },
  { action: 'suspend', label: 'Suspend', status: 'suspended', variant: 'secondary' },
  { action: 'reset', label: 'Set to pending', status: 'pending', variant: 'secondary' },
]

export function AdminTeacherCard({ teacher }: any) {
  const [status, setStatus] = useState(teacher.status)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState<Action | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)

  async function handleAction(action: Action) {
    setError('')
    setPendingAction(action)
    const response = await fetch('/api/teacher/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: teacher.id, action }),
    })
    const result = await response.json()
    setPendingAction(null)
    if (!response.ok) {
      setError(result.error || 'Unable to update status')
      return
    }
    setStatus(STATUS_OPTIONS.find((option) => option.action === action)!.status)
    setEditing(false)
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-slate-900">{teacher.profiles?.full_name || teacher.profiles?.email || 'Teacher'}</p>
          <p className="text-slate-600">{teacher.headline}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            Submitted {teacher.created_at ? new Date(teacher.created_at).toLocaleDateString() : 'unknown date'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Collapse full profile' : 'View full profile'}
            className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {expanded ? 'Hide profile' : 'View full profile'}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Bio</p>
            <p className="mt-1">{teacher.bio || '—'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Subjects</p>
              <p className="mt-1">{teacher.subjects?.length ? teacher.subjects.join(', ') : '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Languages</p>
              <p className="mt-1">{teacher.languages?.length ? teacher.languages.join(', ') : '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Hourly rate</p>
              <p className="mt-1">£{teacher.hourly_rate}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Stripe payouts</p>
              <p className="mt-1">{teacher.stripe_charges_enabled ? 'Enabled' : 'Not completed yet'}</p>
            </div>
          </div>
          {teacher.video_url ? (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Intro video</p>
              <a href={teacher.video_url} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-brand-600 underline">
                {teacher.video_url}
              </a>
            </div>
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Verification documents</p>
            {teacher.documentUrls?.length ? (
              <ul className="mt-1 space-y-1">
                {teacher.documentUrls.map((doc: { name: string; url: string }, index: number) => (
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
      ) : null}

      <div className="mt-4">
        {status === 'pending' ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Button type="button" onClick={() => handleAction('approve')} variant="primary" loading={pendingAction === 'approve'} disabled={pendingAction !== null}>
              Approve
            </Button>
            <Button type="button" onClick={() => handleAction('reject')} variant="secondary" loading={pendingAction === 'reject'} disabled={pendingAction !== null}>
              Reject
            </Button>
            <Button type="button" onClick={() => handleAction('suspend')} variant="secondary" loading={pendingAction === 'suspend'} disabled={pendingAction !== null}>
              Suspend
            </Button>
          </div>
        ) : editing ? (
          <div className="grid gap-2 sm:grid-cols-4">
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
            <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={pendingAction !== null}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <Pencil className="h-4 w-4" />
            Change status
          </button>
        )}
      </div>
      {error ? <FormMessage type="error" className="mt-3">{error}</FormMessage> : null}
    </div>
  )
}
