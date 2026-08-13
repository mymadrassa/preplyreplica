'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Wallet } from 'lucide-react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { FormMessage } from '@/components/FormMessage'

interface AdminPayoutConfirmCardProps {
  bookingId: string
  subject: string
  startAt: string
  teacherName: string
  studentName: string
  teacherConfirmedAt: string
  studentJoinedAt: string | null
  teacherJoinedAt: string | null
}

export function AdminPayoutConfirmCard({
  bookingId,
  subject,
  startAt,
  teacherName,
  studentName,
  teacherConfirmedAt,
  studentJoinedAt,
  teacherJoinedAt,
}: AdminPayoutConfirmCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setError('')
    setLoading(true)
    const response = await fetch(`/api/admin/bookings/${bookingId}/confirm-completion`, { method: 'POST' })
    const result = await response.json()
    setLoading(false)
    if (!response.ok) {
      setError(result.error || 'Unable to confirm this session.')
      return
    }
    router.refresh()
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{subject}</p>
          <p className="text-slate-900">{teacherName} · {studentName}</p>
          <p className="text-sm text-slate-500">{new Date(startAt).toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-400">Teacher confirmed {new Date(teacherConfirmedAt).toLocaleString()}</p>
          {!studentJoinedAt ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" /> Student never joined this session
            </p>
          ) : null}
          {!teacherJoinedAt ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" /> Teacher never joined this session
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button type="button" onClick={confirm} loading={loading} disabled={loading}>
            <Wallet className="h-4 w-4" aria-hidden="true" /> Confirm & release payout
          </Button>
          {error ? <FormMessage type="error">{error}</FormMessage> : null}
        </div>
      </div>
    </Card>
  )
}
