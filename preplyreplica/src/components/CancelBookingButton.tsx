'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { XCircle } from 'lucide-react'
import { Button } from '@/components/Button'
import { FormMessage } from '@/components/FormMessage'

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  async function cancel() {
    setError('')
    setLoading(true)
    const response = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' })
    const result = await response.json()
    setLoading(false)
    if (!response.ok) {
      setError(result.error || 'Unable to cancel this booking.')
      return
    }
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="mt-2 flex flex-col items-end gap-2">
        <p className="text-xs text-slate-500">Cancel and refund this lesson?</p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={loading}>
            Keep booking
          </Button>
          <Button type="button" variant="primary" onClick={cancel} loading={loading} disabled={loading}>
            Yes, cancel
          </Button>
        </div>
        {error ? <FormMessage type="error">{error}</FormMessage> : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
    >
      <XCircle className="h-4 w-4" aria-hidden="true" />
      Cancel booking
    </button>
  )
}
