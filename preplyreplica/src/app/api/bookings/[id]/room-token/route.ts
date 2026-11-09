import { NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { createServerClient } from '@/lib/supabase/server'
import { joinWindow, lessonRoomName, OPENS_BEFORE_MINUTES } from '@/lib/lessonRoom'
import { loadParticipants } from '@/lib/participantNames'

/**
 * A short-lived pass to the lesson's video room, for the booking's student or
 * teacher only, while the room is open. LiveKit checks the pass; nobody can
 * enter a room without one.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  // Only the server needs it (it's handed to the browser with the pass).
  const url = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL
  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json({ error: 'Video lessons aren’t set up yet (LiveKit settings missing).' }, { status: 503 })
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, student_id, teacher_id, status, start_at, end_at')
    .eq('id', params.id)
    .maybeSingle()
  if (!booking || (booking.student_id !== userId && booking.teacher_id !== userId)) {
    return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 })
  }
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'This lesson isn’t confirmed.' }, { status: 409 })
  }
  const window = joinWindow(booking)
  if (window.state === 'too-early') {
    return NextResponse.json({ error: `The room opens ${OPENS_BEFORE_MINUTES} minutes before the lesson.` }, { status: 409 })
  }
  if (window.state === 'ended') {
    return NextResponse.json({ error: 'This lesson has ended.' }, { status: 409 })
  }

  const role = booking.teacher_id === userId ? 'teacher' : 'student'
  const name = (await loadParticipants([userId])).get(userId)?.name || (role === 'teacher' ? 'Teacher' : 'Student')

  const token = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name,
    metadata: JSON.stringify({ role }),
    // Valid until the room closes, so a reconnect late in the lesson still works.
    ttl: Math.max(60, Math.floor((window.closesAt.getTime() - Date.now()) / 1000)),
  })
  token.addGrant({ room: lessonRoomName(booking.id), roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true })

  return NextResponse.json({ token: await token.toJwt(), url })
}
