// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(teacher)/dashboard/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, CalendarDays, CalendarPlus, ClipboardCheck, PartyPopper, Star, Video, Wallet } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { ApprovalTimeline, buildTeacherApprovalSteps } from '@/components/ApprovalTimeline'
import { getTeacherReadiness } from '@/lib/teacherReadiness'
import { StripeOnboardingSuccessBanner } from '@/components/StripeOnboardingSuccessBanner'
import { BookingActions } from '@/components/BookingActions'
import { BookingsTable, type BookingRow } from '@/components/BookingsTable'
import { dateKey } from '@/lib/availability'

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams: { stripe_onboarding?: string }
}) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id

  if (!userId) {
    redirect('/auth/login')
  }

  const [{ data: teacher }, { data: bookings }, { count: identityDocumentCount }] = await Promise.all([
    supabase.from('teacher_profiles').select('*, profiles(*)').eq('id', userId).single(),
    supabase.from('bookings').select('*, profiles!student_id(*)').eq('teacher_id', userId).order('start_at', { ascending: true }).limit(10),
    supabase.from('teacher_documents').select('id', { count: 'exact', head: true }).eq('teacher_id', userId).eq('kind', 'identity').or('review_change.is.null,review_change.eq.remove'),
  ])

  if (!teacher) {
    redirect('/teacher/onboarding')
  }

  // The approval timeline stays visible (all-green) for exactly one visit
  // after approval -- the moment the teacher is actually notified in-app,
  // alongside the congratulations email sent from /api/teacher/validate --
  // then disappears on every visit after that.
  const justApproved = teacher.status === 'approved' && !teacher.approval_seen_at
  const showTimeline = teacher.status !== 'approved' || justApproved

  const readiness = getTeacherReadiness({
    headline: teacher.headline,
    bio: teacher.bio,
    subjects: teacher.subjects,
    languages: teacher.languages,
    hourly_rate: teacher.hourly_rate,
    avatar_url: teacher.profiles?.avatar_url ?? null,
    identityDocumentCount: identityDocumentCount ?? 0,
    stripe_charges_enabled: teacher.stripe_charges_enabled,
  })

  if (justApproved) {
    await supabase.from('teacher_profiles').update({ approval_seen_at: new Date().toISOString() }).eq('id', userId)
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Teacher dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your teaching schedule</h1>
      </div>
      {!teacher?.stripe_charges_enabled ? (
        <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-amber-900">
              <strong>Finish your Stripe payout setup</strong> to start accepting bookings — your profile can't be approved or receive payments until this is complete.
            </p>
          </div>
          <Link href="/teacher/profile/payouts" className="whitespace-nowrap rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            Complete Stripe setup
          </Link>
        </div>
      ) : searchParams.stripe_onboarding === 'success' ? (
        <StripeOnboardingSuccessBanner />
      ) : null}
      {justApproved ? (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-6">
          <PartyPopper className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
          <p className="text-emerald-900">
            <strong>Congratulations — your profile is approved!</strong> You're now visible to students and can start accepting bookings.
          </p>
        </div>
      ) : null}
      {showTimeline ? (
        <Card className="mb-8">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Approval progress</p>
          <ApprovalTimeline
            steps={buildTeacherApprovalSteps({ status: teacher.status, readiness })}
          />
        </Card>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <ClipboardCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Profile status</p>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-3xl font-semibold capitalize text-slate-900">{teacher.status === 'draft' ? 'Not submitted' : teacher.status}</p>
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
        <div className="mt-6">
          <BookingsTable
            counterpartLabel="Student"
            emptyMessage="No upcoming bookings yet."
            rows={(bookings ?? []).map(
              (booking): BookingRow => ({
                id: booking.id,
                subject: booking.subject,
                startAt: booking.start_at,
                status: booking.status,
                counterpartName: booking.profiles?.full_name || booking.profiles?.email || 'Student',
                counterpartAvatarUrl: booking.profiles?.avatar_url,
                isTrial: booking.is_trial,
              })
            )}
            renderActions={(row) => {
              const booking = bookings?.find((b) => b.id === row.id)
              if (!booking) return null
              return (
                <>
                  <Link
                    href={`/teacher/availability?date=${dateKey(new Date(booking.start_at))}`}
                    title="View in calendar"
                    className="text-slate-500 hover:text-slate-700"
                  >
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  {booking.status === 'confirmed' ? (
                    <>
                      <Link href={`/session/${booking.id}`} title="Join session" className="text-brand-700 hover:text-brand-800">
                        <Video className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <a href={`/api/bookings/${booking.id}/calendar`} title="Add to calendar" className="text-brand-600 hover:text-brand-700">
                        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </>
                  ) : null}
                  <BookingActions
                    compact
                    bookingId={booking.id}
                    status={booking.status}
                    endAt={booking.end_at}
                    teacherConfirmedAt={booking.teacher_confirmed_at}
                  />
                </>
              )
            }}
          />
        </div>
      </div>
    </main>
  )
}
