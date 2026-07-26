// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/session/[bookingId]/page.tsx
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { createJitsiRoomUrl } from '@/lib/jitsi'

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
    .select('*')
    .eq('id', params.bookingId)
    .single()

  if (error || !booking) return notFound()
  if (booking.student_id !== userId && booking.teacher_id !== userId) return notFound()

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

  const roomUrl = createJitsiRoomUrl(booking.id)

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Live lesson</h1>
        <p className="mt-2 text-slate-600">Room for booking {booking.id}</p>
        <div className="mt-6 aspect-[16/9] overflow-hidden rounded-3xl bg-slate-900">
          <iframe src={roomUrl} className="h-full w-full" allow="camera; microphone; fullscreen" />
        </div>
      </div>
    </main>
  )
}
