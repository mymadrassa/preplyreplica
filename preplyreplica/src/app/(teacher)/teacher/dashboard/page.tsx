// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(teacher)/dashboard/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, BookOpenCheck, CalendarDays, CalendarPlus, ClipboardCheck, PartyPopper, Star, Video, Wallet } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { ApprovalTimeline, buildTeacherApprovalSteps } from '@/components/ApprovalTimeline'
import { getTeacherReadiness } from '@/lib/teacherReadiness'
import { PayoutSetupSuccessBanner } from '@/components/PayoutSetupSuccessBanner'
import { getPaymentProvider } from '@/lib/payments'
import { syncPayoutStatus } from '@/lib/payments/payoutSetup'
import { TierProgress } from '@/components/TierProgress'
import { isTier } from '@/lib/pricing'
import { nextTierProgress } from '@/lib/tiers'
import { loadTeacherStats } from '@/lib/loadTeacherStats'
import { BookingActions } from '@/components/BookingActions'
import { ReportProblemButton } from '@/components/SessionFeedbackPrompt'
import { BookingsTable, type BookingRow } from '@/components/BookingsTable'
import { dateKey } from '@/lib/availability'
import { loadParticipants } from '@/lib/participantNames'

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams: { payouts_setup?: string }
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
  const studentPeople = await loadParticipants((bookings ?? []).map((b) => b.student_id))

  // Back from the provider's payout setup: read the account's status directly
  // rather than waiting for its webhook, so the step turns green straight away.
  if (searchParams.payouts_setup === 'success' && !teacher.payments_enabled) {
    teacher.payments_enabled = await syncPayoutStatus(teacher)
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
    phone: teacher.profiles?.phone ?? null,
    gender: teacher.profiles?.gender ?? null,
    identityDocumentCount: identityDocumentCount ?? 0,
    payments_enabled: teacher.payments_enabled,
  })

  const tier = isTier(teacher.tier) ? teacher.tier : 'starter'
  const tierProgress = teacher.status === 'approved' ? nextTierProgress(tier, await loadTeacherStats(supabase, teacher)) : undefined

  if (justApproved) {
    await supabase.from('teacher_profiles').update({ approval_seen_at: new Date().toISOString() }).eq('id', userId)
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Teacher dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your teaching schedule</h1>
      </div>
      {!teacher?.payments_enabled ? (
        <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-amber-900">
              <strong>Finish your {getPaymentProvider(teacher.payment_provider).displayName} payout setup</strong> to start accepting bookings — your profile can't be approved or receive payments until this is complete.
            </p>
          </div>
          <Link href="/teacher/profile/payouts" className="whitespace-nowrap rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            Complete payout setup
          </Link>
        </div>
      ) : searchParams.payouts_setup === 'success' ? (
        <PayoutSetupSuccessBanner providerName={getPaymentProvider(teacher.payment_provider).displayName} />
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
        {tierProgress !== undefined ? (
          <TierProgress tier={tier} progress={tierProgress} locked={teacher.tier_locked} />
        ) : (
          <Card>
            <Wallet className="h-5 w-5 text-brand-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Hourly rate</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">£{teacher?.hourly_rate}</p>
          </Card>
        )}
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
                counterpartName: studentPeople.get(booking.student_id)?.name ?? 'Student',
                counterpartAvatarUrl: studentPeople.get(booking.student_id)?.avatarUrl,
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
                  {booking.status === 'confirmed' || booking.status === 'completed' ? (
                    <Link href={`/teacher/homework/${booking.id}`} title="Homework (cahier de texte)" className="text-emerald-600 hover:text-emerald-700">
                      <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                  <BookingActions compact bookingId={booking.id} status={booking.status} />
                  {booking.status === 'completed' || (booking.status === 'confirmed' && new Date(booking.end_at) <= new Date()) ? (
                    <ReportProblemButton
                      prompt={{ bookingId: booking.id, role: 'teacher', otherName: studentPeople.get(booking.student_id)?.name ?? 'your student', subject: booking.subject, startAt: booking.start_at, endAt: booking.end_at }}
                      className="whitespace-nowrap text-xs"
                    />
                  ) : null}
                </>
              )
            }}
          />
        </div>
      </div>
    </main>
  )
}
