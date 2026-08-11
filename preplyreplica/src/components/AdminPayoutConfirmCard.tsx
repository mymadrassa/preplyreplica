'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet } from 'lucide-react'
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
}

export function AdminPayoutConfirmCard({ bookingId, subject, startAt, teacherName, studentName, teacherConfirmedAt }: AdminPayoutConfirmCardProps) {
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
