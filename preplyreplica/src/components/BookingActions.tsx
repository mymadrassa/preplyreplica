'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/Button'
import { FormMessage } from '@/components/FormMessage'

interface BookingActionsProps {
  bookingId: string
  status: string
  endAt: string
  teacherConfirmedAt: string | null
}

/** Teacher-facing actions for a single booking: approve/reject a pending request, or mark a finished session complete. */
export function BookingActions({ bookingId, status, endAt, teacherConfirmedAt }: BookingActionsProps) {
  const router = useRouter()
  const [pending, setPending] = useState<'approve' | 'reject' | 'complete' | null>(null)
  const [error, setError] = useState('')

  async function respond(action: 'approve' | 'reject') {
    setError('')
    setPending(action)
    const response = await fetch(`/api/bookings/${bookingId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const result = await response.json()
    setPending(null)
    if (!response.ok) {
      setError(result.error || 'Unable to process this response.')
      return
    }
    router.refresh()
  }

  async function markComplete() {
    setError('')
    setPending('complete')
    const response = await fetch(`/api/bookings/${bookingId}/complete`, { method: 'POST' })
    const result = await response.json()
    setPending(null)
    if (!response.ok) {
      setError(result.error || 'Unable to mark this session as complete.')
      return
    }
    router.refresh()
  }

  if (status === 'pending') {
    return (
      <div className="mt-2 flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="primary" onClick={() => respond('approve')} loading={pending === 'approve'} disabled={pending !== null}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve
          </Button>
          <Button type="button" variant="secondary" onClick={() => respond('reject')} loading={pending === 'reject'} disabled={pending !== null}>
            <XCircle className="h-4 w-4" aria-hidden="true" /> Decline
          </Button>
        </div>
        {error ? <FormMessage type="error">{error}</FormMessage> : null}
      </div>
    )
  }

  if (status === 'confirmed' && new Date(endAt) <= new Date()) {
    if (teacherConfirmedAt) {
      return <p className="mt-2 text-sm text-slate-500">Marked complete — awaiting admin confirmation for payout.</p>
    }
    return (
      <div className="mt-2 flex flex-col items-end gap-2">
        <Button type="button" variant="secondary" onClick={markComplete} loading={pending === 'complete'} disabled={pending !== null}>
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Mark session as completed
        </Button>
        {error ? <FormMessage type="error">{error}</FormMessage> : null}
      </div>
    )
  }

  return null
}
