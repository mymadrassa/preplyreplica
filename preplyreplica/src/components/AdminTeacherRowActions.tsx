'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Eye } from 'lucide-react'
import { AdminTeacherDetailModal } from '@/components/AdminTeacherDetailModal'

interface AdminTeacherRowActionsProps {
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
}

/** Quick compact approve/reject (only while pending) plus a "View profile" button that opens the full detail modal — mirrors BookingActions' compact pattern for table cells. */
export function AdminTeacherRowActions(props: AdminTeacherRowActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState('')

  async function quickAction(action: 'approve' | 'reject') {
    setError('')
    setPending(action)
    const response = await fetch('/api/teacher/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: props.teacherId, action }),
    })
    const result = await response.json()
    setPending(null)
    if (!response.ok) {
      setError(result.error || 'Unable to update status')
      return
    }
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
        {props.status === 'pending' ? (
          <>
            <button type="button" onClick={() => quickAction('approve')} disabled={pending !== null} title="Approve" className="cursor-pointer rounded-full p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => quickAction('reject')} disabled={pending !== null} title="Reject" className="cursor-pointer rounded-full p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50">
              <XCircle className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : null}
        <button type="button" onClick={() => setOpen(true)} title="View profile" className="cursor-pointer rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <Eye className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {open ? <AdminTeacherDetailModal {...props} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
