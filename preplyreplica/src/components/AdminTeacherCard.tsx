// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/AdminTeacherCard.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/Button'
import { StatusBadge } from '@/components/StatusBadge'

export function AdminTeacherCard({ teacher }: any) {
  const [status, setStatus] = useState(teacher.status)
  const [error, setError] = useState('')

  async function handleAction(action: 'approve' | 'reject' | 'suspend') {
    setError('')
    const response = await fetch('/api/teacher/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: teacher.id, action }),
    })
    const result = await response.json()
    if (!response.ok) {
      setError(result.error || 'Unable to update status')
      return
    }
    setStatus(action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'suspended')
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-slate-900">{teacher.profiles?.full_name}</p>
          <p className="text-slate-600">{teacher.headline}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="mt-4 text-slate-600">{teacher.bio}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button type="button" onClick={() => handleAction('approve')} variant="primary">Approve</Button>
        <Button type="button" onClick={() => handleAction('reject')} variant="secondary">Reject</Button>
        <Button type="button" onClick={() => handleAction('suspend')} variant="secondary">Suspend</Button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
