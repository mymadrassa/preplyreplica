import crypto from 'crypto'

// The live lesson room (video + shared Mushaf), hosted on LiveKit. Server-only:
// the room name is derived from a secret so it can't be guessed from a booking id.

/** The room opens this long before the lesson starts… */
export const OPENS_BEFORE_MINUTES = 10
/** …and stays open this long after it ends, so anyone who drops out can rejoin. */
export const CLOSES_AFTER_MINUTES = 30

/** Deterministic, unguessable room name for a booking. */
export function lessonRoomName(bookingId: string): string {
  const secret = process.env.LIVEKIT_API_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'private-secret'
  const hash = crypto.createHmac('sha256', secret).update(bookingId).digest('hex').slice(0, 20)
  return `lesson-${hash}`
}

export type JoinWindow =
  | { state: 'open'; closesAt: Date }
  | { state: 'too-early'; opensAt: Date }
  | { state: 'ended' }

/** Whether the room can be joined now: from shortly before the start until a while after the end. */
export function joinWindow(booking: { start_at: string; end_at: string }, now: Date = new Date()): JoinWindow {
  const opensAt = new Date(new Date(booking.start_at).getTime() - OPENS_BEFORE_MINUTES * 60_000)
  const closesAt = new Date(new Date(booking.end_at).getTime() + CLOSES_AFTER_MINUTES * 60_000)
  if (now < opensAt) return { state: 'too-early', opensAt }
  if (now > closesAt) return { state: 'ended' }
  return { state: 'open', closesAt }
}
