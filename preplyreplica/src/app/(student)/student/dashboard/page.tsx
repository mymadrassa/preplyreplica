// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(student)/dashboard/page.tsx
import Link from 'next/link'
import { CalendarPlus, CalendarX2, GraduationCap, ListChecks, Video } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'

export default async function StudentDashboardPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id

  if (!userId) {
    return (
      <main className="container mx-auto px-4 py-12">
        <p className="text-slate-700">You must be logged in to view this page.</p>
      </main>
    )
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, teacher_profiles(*, profiles(*))')
    .eq('student_id', userId)
    .order('start_at', { ascending: true })
    .limit(10)

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Student dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your upcoming lessons</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/student/bookings" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            View all lessons
          </Link>
          <Link href="/teachers" className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            Browse teachers
          </Link>
        </div>
      </div>
      <div className="grid gap-6">
        {bookings?.length ? (
          bookings.map((booking) => (
            <Card key={booking.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{booking.subject}</p>
                  <h2 className="text-xl font-semibold text-slate-900">{booking.teacher_profiles?.profiles?.full_name}</h2>
                  <p className="text-slate-600">{new Date(booking.start_at).toLocaleString()} · {booking.duration} min</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={booking.status} />
                  {booking.status === 'confirmed' ? (
                    <div className="mt-2 flex flex-col items-end gap-1">
                      <Link href={`/session/${booking.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                        <Video className="h-4 w-4" aria-hidden="true" />
                        Join session
                      </Link>
                      <a href={`/api/bookings/${booking.id}/calendar`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
                        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                        Add to calendar
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <div className="flex items-center gap-3 text-slate-600">
              <CalendarX2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <p>No bookings yet. Browse teachers to schedule your first lesson.</p>
            </div>
          </Card>
        )}
      </div>
    </main>
  )
}
