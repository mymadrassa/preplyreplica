'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Viewing received feedback (optionally one author's) clears it from the bell. */
export function MarkFeedbackSeen({ authorId }: { authorId?: string }) {
  const router = useRouter()
  useEffect(() => {
    fetch('/api/feedback/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authorId ? { authorId } : {}),
    }).then((response) => {
      if (response.ok) router.refresh()
    })
  }, [authorId, router])
  return null
}
