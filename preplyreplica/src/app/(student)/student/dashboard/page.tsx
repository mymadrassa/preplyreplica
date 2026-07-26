// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(student)/dashboard/page.tsx
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'

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
        <Link href="/teachers" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Browse teachers</Link>
      </div>
      <div className="grid gap-6">
        {bookings?.length ? (
          bookings.map((booking) => (
            <Card key={booking.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{booking.subject}</p>
                  <h2 className="text-xl font-semibold text-slate-900">{booking.teacher_profiles?.profiles?.full_name}</h2>
                  <p className="text-slate-600">{new Date(booking.start_at).toLocaleString()}</p>
                </div>
                <div className="text-right text-slate-700">
                  <p className="font-semibold">{booking.status}</p>
                  <p>{booking.duration} min</p>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-slate-600">No bookings yet. Browse teachers to schedule your first lesson.</p>
          </Card>
        )}
      </div>
    </main>
  )
}
