// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/lib/jitsi.ts
import crypto from 'crypto'

export const JITSI_DOMAIN = 'meet.jit.si'

/** Deterministic, unguessable room name for a booking — same booking always maps to the same room, but the ID can't be derived from it. */
export function getJitsiRoomName(bookingId: string) {
  const secret = process.env.JITSI_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'private-secret'
  const hash = crypto.createHmac('sha256', secret).update(bookingId).digest('hex').slice(0, 16)
  return `preply-${hash}`
}

export function createJitsiRoomUrl(bookingId: string) {
  return `https://${JITSI_DOMAIN}/${getJitsiRoomName(bookingId)}`
}
