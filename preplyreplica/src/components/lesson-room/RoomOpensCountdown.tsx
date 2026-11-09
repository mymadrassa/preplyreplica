'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/** "Opens in 12 min", then reloads the page by itself when the room opens. */
export function RoomOpensCountdown({ opensAt }: { opensAt: string }) {
  const router = useRouter()
  const [now, setNow] = useState(() => Date.now())
  const remaining = new Date(opensAt).getTime() - now

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (remaining <= 0) router.refresh()
  }, [remaining <= 0, router]) // eslint-disable-line react-hooks/exhaustive-deps

  if (remaining <= 0) return <p>Opening the room…</p>
  const minutes = Math.floor(remaining / 60_000)
  const hours = Math.floor(minutes / 60)
  const label = hours >= 24 ? `${Math.floor(hours / 24)} day${hours >= 48 ? 's' : ''}` : hours ? `${hours} h ${minutes % 60} min` : minutes ? `${minutes} min` : `${Math.ceil(remaining / 1000)} s`
  return (
    <p>
      The room opens 10 minutes before the lesson: in <strong>{label}</strong>.
    </p>
  )
}
