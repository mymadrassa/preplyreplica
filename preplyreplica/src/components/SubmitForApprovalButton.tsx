'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/ToastProvider'

/** Sends the teacher's profile to the admin queue; the server re-checks every mandatory step. */
export function SubmitForApprovalButton({ label = 'Submit for approval' }: { label?: string }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    const response = await fetch('/api/teacher/submit', { method: 'POST' })
    const result = await response.json().catch(() => ({}))
    setSubmitting(false)
    if (!response.ok) {
      showToast('error', result.error || 'Unable to submit your profile.')
      return
    }
    showToast('success', 'Submitted! Our team will review your profile.')
    router.refresh()
  }

  return (
    <Button type="button" onClick={submit} loading={submitting}>
      {!submitting ? <Send className="h-4 w-4" aria-hidden="true" /> : null}
      {label}
    </Button>
  )
}
