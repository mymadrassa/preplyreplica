'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Opening the cahier de texte clears its "new homework" notifications. */
export function MarkHomeworkSeen() {
  const router = useRouter()
  useEffect(() => {
    fetch('/api/homework/seen', { method: 'POST' }).then((response) => {
      // Refresh so the bell drops the items; the "New" badges stay until the next visit.
      if (response.ok) router.refresh()
    })
  }, [router])
  return null
}
