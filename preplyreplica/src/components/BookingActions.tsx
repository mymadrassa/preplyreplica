'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/ToastProvider'

interface BookingActionsProps {
  bookingId: string
  status: string
  /** Icon-only buttons sized for a table action cell, instead of the full-width stacked layout built for a card. */
  compact?: boolean
  /** Called after a successful approve/reject, once router.refresh() has been kicked off — the action tells the caller which one happened (e.g. so a popover hosting this can react differently to a decline than an approval). */
  onSuccess?: (action: 'approve' | 'reject') => void
}

/** Teacher-facing actions for a pending booking request: approve or decline. (Lessons count as given once they end; problems are reported from the post-lesson popup.) */
export function BookingActions({ bookingId, status, compact = false, onSuccess }: BookingActionsProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null)

  async function respond(action: 'approve' | 'reject') {
    setPending(action)
    const response = await fetch(`/api/bookings/${bookingId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const result = await response.json()
    setPending(null)
    if (!response.ok) {
      showToast('error', result.error || 'Unable to process this response.')
      return
    }
    router.refresh()
    onSuccess?.(action)
  }

  if (status === 'pending') {
    if (compact) {
      return (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => respond('approve')} disabled={pending !== null} title="Approve" className="cursor-pointer rounded-full p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => respond('reject')} disabled={pending !== null} title="Decline" className="cursor-pointer rounded-full p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50">
            <XCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )
    }
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
      </div>
    )
  }

  return null
}
