// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(student)/dashboard/page.tsx
import Link from 'next/link'
import { CalendarPlus, GraduationCap, ListChecks, Video } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { BookingsTable, type BookingRow } from '@/components/BookingsTable'

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
      <BookingsTable
        counterpartLabel="Teacher"
        emptyMessage="No bookings yet. Browse teachers to schedule your first lesson."
        rows={(bookings ?? []).map(
          (booking): BookingRow => ({
            id: booking.id,
            subject: booking.subject,
            startAt: booking.start_at,
            status: booking.status,
            counterpartName: booking.teacher_profiles?.profiles?.full_name ?? null,
            counterpartAvatarUrl: booking.teacher_profiles?.profiles?.avatar_url,
            counterpartHref: booking.teacher_profiles?.id ? `/teachers/${booking.teacher_profiles.id}` : undefined,
            isTrial: booking.is_trial,
          })
        )}
        renderActions={(row) => {
          const booking = bookings?.find((b) => b.id === row.id)
          if (!booking || booking.status !== 'confirmed') return null
          return (
            <>
              <Link href={`/session/${booking.id}`} title="Join session" className="text-brand-700 hover:text-brand-800">
                <Video className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href={`/api/bookings/${booking.id}/calendar`} title="Add to calendar" className="text-brand-600 hover:text-brand-700">
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              </a>
            </>
          )
        }}
      />
    </main>
  )
}
