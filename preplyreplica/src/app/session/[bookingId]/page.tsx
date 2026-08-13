// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/session/[bookingId]/page.tsx
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getJitsiRoomName } from '@/lib/jitsi'
import { JitsiSessionRoom } from '@/components/JitsiSessionRoom'

interface SessionPageProps {
  params: {
    bookingId: string
  }
}

export default async function SessionPage({ params }: SessionPageProps) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) return notFound()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, teacher_profiles(profiles(full_name)), profiles!student_id(full_name)')
    .eq('id', params.bookingId)
    .single()

  if (error || !booking) return notFound()
  if (booking.student_id !== userId && booking.teacher_id !== userId) return notFound()

  const isTeacher = booking.teacher_id === userId
  const role = isTeacher ? 'teacher' : 'student'
  const teacherName = (booking as any).teacher_profiles?.profiles?.full_name || 'The teacher'
  const studentName = (booking as any).profiles?.full_name || 'The student'
  const displayName = isTeacher ? teacherName : studentName
  const otherPartyName = isTeacher ? studentName : teacherName

  const startTime = new Date(booking.start_at).getTime()
  const now = Date.now()
  const windowMs = 10 * 60 * 1000
  if (now < startTime - windowMs || now > startTime + windowMs) {
    return (
      <main className="container mx-auto px-4 py-12">
        <p className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-700">You can join the session within ten minutes of the scheduled time.</p>
      </main>
    )
  }

  const roomName = getJitsiRoomName(booking.id)

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Live lesson</h1>
        <p className="mt-2 text-slate-600">Room for booking {booking.id}</p>
        <div className="mt-6">
          <JitsiSessionRoom
            bookingId={booking.id}
            roomName={roomName}
            role={role}
            displayName={displayName}
            otherPartyName={otherPartyName}
            endAt={booking.end_at}
          />
        </div>
      </div>
    </main>
  )
}
