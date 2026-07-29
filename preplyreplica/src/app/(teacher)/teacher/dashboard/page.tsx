// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(teacher)/dashboard/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'

export default async function TeacherDashboardPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id

  const [{ data: teacher }, { data: bookings }] = await Promise.all([
    supabase.from('teacher_profiles').select('*, profiles(*)').eq('id', userId).single(),
    supabase.from('bookings').select('*, profiles!student_id(*)').eq('teacher_id', userId).order('start_at', { ascending: true }).limit(10),
  ])

  if (!teacher) {
    redirect('/teacher/onboarding')
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Teacher dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your teaching schedule</h1>
        </div>
        <Link href="/teacher/availability" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Manage availability</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Profile status</p>
          <div className="mt-3 flex items-center gap-3">
            <p className="text-3xl font-semibold text-slate-900">{teacher?.status || 'pending'}</p>
            <StatusBadge status={teacher?.status ?? 'pending'} />
          </div>
          <p className="mt-4 text-slate-600">Your profile is visible to students only after approval.</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Rating</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{Number(teacher?.rating_avg ?? 0).toFixed(1)} / 5</p>
          <p className="text-slate-600">{teacher?.rating_count ?? 0} reviews</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Hourly rate</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">${teacher?.hourly_rate}</p>
        </Card>
      </div>
      <div className="mt-10">
        <h2 className="text-2xl font-semibold text-slate-900">Next bookings</h2>
        <div className="mt-6 grid gap-4">
          {bookings?.length ? bookings.map((booking) => (
            <Card key={booking.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{booking.subject}</p>
                  <p className="text-slate-700">{new Date(booking.start_at).toLocaleString()}</p>
                </div>
                <p className="font-semibold text-slate-900">{booking.status}</p>
              </div>
            </Card>
          )) : <Card><p className="text-slate-600">No upcoming bookings yet.</p></Card>}
        </div>
      </div>
    </main>
  )
}
