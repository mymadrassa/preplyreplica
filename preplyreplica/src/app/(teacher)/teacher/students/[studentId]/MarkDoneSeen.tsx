'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Opening a student's follow-up clears their "finished homework" notifications. */
export function MarkDoneSeen({ studentId }: { studentId: string }) {
  const router = useRouter()
  useEffect(() => {
    fetch(`/api/teacher/students/${studentId}/seen`, { method: 'POST' }).then((response) => {
      if (response.ok) router.refresh()
    })
  }, [studentId, router])
  return null
}
