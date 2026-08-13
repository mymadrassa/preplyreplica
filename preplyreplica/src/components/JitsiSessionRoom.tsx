'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { JitsiMeeting } from '@jitsi/react-sdk'
import { Loader2 } from 'lucide-react'
import { JITSI_DOMAIN } from '@/lib/jitsi'
import type IJitsiMeetExternalApi from '@jitsi/react-sdk/lib/types/IJitsiMeetExternalApi'

interface JitsiSessionRoomProps {
  bookingId: string
  roomName: string
  role: 'student' | 'teacher'
  displayName: string
  otherPartyName: string
  endAt: string
}

export function JitsiSessionRoom({ bookingId, roomName, role, displayName, otherPartyName, endAt }: JitsiSessionRoomProps) {
  const router = useRouter()
  const [waitingForOther, setWaitingForOther] = useState(true)
  const redirected = useRef(false)

  const postPresence = useCallback(
    (event: 'joined' | 'left') => {
      fetch(`/api/bookings/${bookingId}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      }).catch(() => {})
    },
    [bookingId]
  )

  function handleApiReady(api: IJitsiMeetExternalApi) {
    const updateWaiting = () => setWaitingForOther(api.getNumberOfParticipants() < 2)

    api.on('videoConferenceJoined', () => {
      postPresence('joined')
      updateWaiting()
    })
    api.on('videoConferenceLeft', () => postPresence('left'))
    api.on('participantJoined', updateWaiting)
    api.on('participantLeft', updateWaiting)
  }

  function handleReadyToClose() {
    // Jitsi can fire this more than once (e.g. feedback dialog flows) — only navigate once.
    if (redirected.current) return
    redirected.current = true

    if (role === 'teacher') {
      const sessionEnded = Date.now() >= new Date(endAt).getTime()
      const goToDashboard = () => router.push('/teacher/dashboard')
      if (sessionEnded) {
        // Best-effort: mark the session complete on the way out. A 409 just
        // means it's already marked (or a rare timing edge case) — either
        // way the teacher still ends up back on their dashboard.
        fetch(`/api/bookings/${bookingId}/complete`, { method: 'POST' }).catch(() => {}).finally(goToDashboard)
      } else {
        goToDashboard()
      }
    } else {
      router.push('/student/bookings')
    }
  }

  return (
    <div>
      {waitingForOther ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-slate-500" aria-hidden="true" />
          <p className="text-sm text-slate-600">Waiting for {otherPartyName} to join…</p>
        </div>
      ) : null}
      <div className="aspect-[16/9] overflow-hidden rounded-3xl bg-slate-900">
        <JitsiMeeting
          domain={JITSI_DOMAIN}
          roomName={roomName}
          userInfo={{ displayName, email: '' }}
          onApiReady={handleApiReady}
          onReadyToClose={handleReadyToClose}
          getIFrameRef={(node) => {
            node.style.height = '100%'
            node.style.width = '100%'
          }}
        />
      </div>
    </div>
  )
}
