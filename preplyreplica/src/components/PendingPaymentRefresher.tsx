'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const MAX_ATTEMPTS = 4
const RETRY_DELAY_MS = 3000

/**
 * Right after a student is redirected back from Stripe Checkout, this page's
 * server-fetched data can briefly still show `pending_payment` — the webhook
 * that flips it to `pending` hasn't landed yet. Rather than leave the student
 * staring at a stale "processing" status, softly re-fetch a few times so the
 * page catches up on its own. Stops after a few tries either way.
 */
export function PendingPaymentRefresher({ active }: { active: boolean }) {
  const router = useRouter()
  const attempts = useRef(0)

  useEffect(() => {
    if (!active || attempts.current >= MAX_ATTEMPTS) return
    attempts.current += 1
    const timer = setTimeout(() => router.refresh(), RETRY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [active, router])

  return null
}
