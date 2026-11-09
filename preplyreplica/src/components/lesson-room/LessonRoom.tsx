'use client'

import '@livekit/components-styles'
import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LiveKitRoom, PreJoin, RoomAudioRenderer, StartAudio, type LocalUserChoices } from '@livekit/components-react'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ToastProvider'
import { MushafSessionView } from '@/components/MushafSessionView'
import type { MushafLesson } from '@preply-clone/mushaf'
import type { HomeworkItem } from '@/lib/homeworkItems'
import { RoomStage } from './RoomStage'

export interface LessonMushafProps {
  sessionId: string
  teacherId: string
  currentUserId: string
  initialPage: number
  lessons: MushafLesson[]
  homework: { items: HomeworkItem[]; canTick: boolean; assign?: { href: string; label: string } | null }
}

/**
 * What to tell someone when their camera or microphone can't be used, from
 * the browser's error (its own message is just e.g. "Permission denied").
 */
function deviceErrorMessage(error: Error): string {
  switch (error.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Your browser is blocking the camera or microphone for this site. Click the camera icon (or the padlock) in the address bar, choose "Allow", then reload the page.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera or microphone is already in use by another app or browser window. Close it, then try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera or microphone was found. Plug one in, or join with them turned off.'
    default:
      return error.message || 'Camera or microphone unavailable. Check your browser permissions.'
  }
}

interface LessonRoomProps {
  bookingId: string
  role: 'teacher' | 'student'
  displayName: string
  otherPartyName: string
  /** Where to go after leaving (with the feedback popup). */
  home: string
  mushaf: LessonMushafProps
}

/**
 * The live lesson: a camera/microphone check first, then the room filling the
 * window, with the shared Mushaf in the centre and the videos floating over it (LiveKit).
 */
export function LessonRoom({ bookingId, role, displayName, otherPartyName, home, mushaf }: LessonRoomProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [choices, setChoices] = useState<LocalUserChoices | null>(null)
  const [connection, setConnection] = useState<{ token: string; url: string } | null>(null)
  const [joining, setJoining] = useState(false)
  const [dropped, setDropped] = useState(false)
  const leavingRef = useRef(false)

  const postPresence = useCallback(
    (event: 'joined' | 'left') => {
      fetch(`/api/bookings/${bookingId}/presence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }) }).catch(() => {})
    },
    [bookingId]
  )

  const fetchPass = useCallback(async () => {
    const response = await fetch(`/api/bookings/${bookingId}/room-token`, { method: 'POST' })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Unable to join the lesson.')
    return result as { token: string; url: string }
  }, [bookingId])

  async function join(values: LocalUserChoices) {
    setJoining(true)
    try {
      setConnection(await fetchPass())
      setChoices(values)
      setDropped(false)
    } catch (error) {
      showToast('error', (error as Error).message)
    } finally {
      setJoining(false)
    }
  }

  /** Leaving on purpose: record it, then the post-lesson popup (how did it go, or report a problem). */
  const leave = useCallback(() => {
    leavingRef.current = true
    postPresence('left')
    router.push(`${home}?feedback=${bookingId}`)
  }, [bookingId, home, postPresence, router])

  if (!connection || !choices) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl flex-col justify-center px-4 py-10" data-lk-theme="default">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Live lesson</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">With {otherPartyName}</h1>
          <p className="mt-2 text-slate-600">Check your camera and microphone, then join.</p>
          {dropped ? <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">You were disconnected. Join again to continue the lesson.</p> : null}
        </div>
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-4">
          <PreJoin
            defaults={{ username: displayName, videoEnabled: true, audioEnabled: true }}
            persistUserChoices
            joinLabel={joining ? 'Joining…' : 'Join lesson'}
            micLabel="Microphone"
            camLabel="Camera"
            userLabel="Your name"
            onSubmit={join}
            onError={(error) => showToast('error', deviceErrorMessage(error))}
          />
          {joining ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
              <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden="true" />
            </div>
          ) : null}
        </div>
      </main>
    )
  }

  return (
    // Pinned to the screen: the room is exactly the window and the page never scrolls, only the Mushaf
    // inside it. (LiveKit's stylesheet sets the room's height to 100% of its parent, which would
    // otherwise let it grow to the Mushaf's full length.)
    <div className="fixed inset-0 overflow-hidden">
      <LiveKitRoom
        serverUrl={connection.url}
        token={connection.token}
        connect
        video={choices.videoEnabled ? { deviceId: choices.videoDeviceId } : false}
        audio={choices.audioEnabled ? { deviceId: choices.audioDeviceId } : false}
        options={{ adaptiveStream: true, dynacast: true }}
        onConnected={() => postPresence('joined')}
        onDisconnected={() => {
          if (leavingRef.current) return
          // Dropped for good (LiveKit already retried): back to the join step.
          postPresence('left')
          setConnection(null)
          setDropped(true)
        }}
        onError={(error) => showToast('error', deviceErrorMessage(error))}
        data-lk-theme="default"
        className="overflow-hidden"
        style={{ height: '100%' }}
      >
        <RoomStage role={role} otherPartyName={otherPartyName} onLeave={leave} mushaf={<MushafSessionView role={role} bookingId={bookingId} {...mushaf} />} />
        <RoomAudioRenderer />
        <StartAudio label="Click to turn on the sound" />
      </LiveKitRoom>
    </div>
  )
}
