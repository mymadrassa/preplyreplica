// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(teacher)/dashboard/page.tsx
import Link from 'next/link'
import { AlertTriangle, CalendarClock, CalendarPlus, CalendarX2, ClipboardCheck, Pencil, Star, Video, Wallet } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { StripeOnboardingSuccessBanner } from '@/components/StripeOnboardingSuccessBanner'

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams: { stripe_onboarding?: string }
}) {
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
        <div className="flex gap-3">
          <Link href="/teacher/onboarding" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit profile
          </Link>
          <Link href="/teacher/availability" className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Manage availability
          </Link>
        </div>
      </div>
      {!teacher?.stripe_charges_enabled ? (
        <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-amber-900">
              <strong>Finish your Stripe payout setup</strong> to start accepting bookings — your profile can't be approved or receive payments until this is complete.
            </p>
          </div>
          <Link href="/teacher/onboarding" className="whitespace-nowrap rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            Complete Stripe setup
          </Link>
        </div>
      ) : searchParams.stripe_onboarding === 'success' ? (
        <StripeOnboardingSuccessBanner />
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <ClipboardCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Profile status</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-3xl font-semibold capitalize text-slate-900">{teacher?.status || 'pending'}</p>
            <StatusBadge status={teacher?.status ?? 'pending'} />
          </div>
          <p className="mt-4 text-slate-600">Your profile is visible to students only after approval.</p>
        </Card>
        <Card>
          <Star className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Rating</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{teacher?.rating_avg.toFixed(1)} / 5</p>
          <p className="text-slate-600">{teacher?.rating_count ?? 0} reviews</p>
        </Card>
        <Card>
          <Wallet className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Hourly rate</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">£{teacher?.hourly_rate}</p>
        </Card>
      </div>
      <div className="mt-10">
        <h2 className="text-2xl font-semibold text-slate-900">Next bookings</h2>
        <div className="mt-6 grid gap-4">
          {bookings?.length ? bookings.map((booking) => (
            <Card key={booking.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{booking.subject}</p>
                  <p className="text-slate-700">{new Date(booking.start_at).toLocaleString()}</p>
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
          )) : (
            <Card>
              <div className="flex items-center gap-3 text-slate-600">
                <CalendarX2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
                <p>No upcoming bookings yet.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
