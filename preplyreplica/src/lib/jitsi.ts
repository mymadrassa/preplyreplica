// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/lib/jitsi.ts
import crypto from 'crypto'

export function createJitsiRoomUrl(bookingId: string) {
  const secret = process.env.JITSI_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'private-secret'
  const hash = crypto.createHmac('sha256', secret).update(bookingId).digest('hex').slice(0, 16)
  const roomName = `preply-${hash}`
  return `https://meet.jit.si/${roomName}`
}
