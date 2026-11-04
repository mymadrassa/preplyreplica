// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(student)/bookings/page.tsx
import Link from 'next/link'
import { ArrowLeft, CalendarPlus, Video } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { Button } from '@/components/Button'
import { CancelBookingButton } from '@/components/CancelBookingButton'
import { PendingPaymentRefresher } from '@/components/PendingPaymentRefresher'
import { RatingStars } from '@/components/RatingStars'
import { FeedbackTags } from '@/components/FeedbackTags'
import { GiveFeedbackButton } from '@/components/SessionFeedbackPrompt'
import { MarkFeedbackSeen } from '@/components/MarkFeedbackSeen'
import { StudentPackages } from '@/components/StudentPackages'
import { lessonsLeft } from '@/lib/packages'
import { toPounds } from '@/lib/pricing'
import { BookingsTable, type BookingRow } from '@/components/BookingsTable'
import { CANCELLATION_CUTOFF_HOURS } from '@/lib/constants'

const FILTERS: Record<string, string[] | null> = {
  all: null,
  upcoming: ['confirmed'],
  awaiting: ['pending_payment', 'pending'],
  completed: ['completed'],
  cancelled: ['cancelled', 'rejected'],
}

function statusMessage(status: string) {
  switch (status) {
    case 'pending_payment':
      return "We're confirming your payment — this usually takes just a few seconds and this page will update on its own."
    case 'pending':
      return 'Your payment is authorized but not charged yet — the teacher has been notified and needs to confirm this booking.'
    case 'rejected':
      return "The teacher wasn't able to accept this request — you weren't charged."
    case 'cancelled':
      return 'This booking was cancelled and refunded.'
    default:
      return null
  }
}

interface StudentBookingsPageProps {
  searchParams: {
    filter?: string
    q?: string
    /** Back from a package checkout. */
    package?: string
  }
}

export default async function StudentBookingsPage({ searchParams }: StudentBookingsPageProps) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id

  if (!userId) {
    return (
      <main className="container mx-auto px-4 py-12">
        <p className="text-slate-700">Please log in to see your bookings.</p>
      </main>
    )
  }

  const [{ data: allBookings }, { data: feedbackRows }, { data: packageRows }] = await Promise.all([
    supabase.from('bookings').select('*, teacher_profiles(*, profiles(*))').eq('student_id', userId).order('start_at', { ascending: false }),
    // Mine about each lesson, and the teacher's tags about it.
    supabase.from('session_feedback').select('booking_id, author_id, status, rating, visibility, tags, recipient_seen_at').or(`author_id.eq.${userId},recipient_id.eq.${userId}`),
    supabase.from('lesson_packages').select('*, teacher_profiles(profiles(full_name))').eq('student_id', userId).in('status', ['active', 'used_up']).order('created_at', { ascending: false }),
  ])
  const packages = (packageRows ?? []).map((pkg) => ({
    id: pkg.id,
    teacherId: pkg.teacher_id,
    teacherName: (pkg.teacher_profiles as { profiles: { full_name: string | null } | null } | null)?.profiles?.full_name || 'Your teacher',
    lessonsLeft: lessonsLeft(pkg),
    lessonsTotal: pkg.lessons_total,
    refundPerLesson: toPounds(pkg.refund_per_lesson),
    expiresAt: pkg.expires_at,
  }))
  const hasPackageWith = new Set(packages.map((pkg) => pkg.teacherId))
  const myFeedback = new Map((feedbackRows ?? []).filter((f) => f.author_id === userId).map((f) => [f.booking_id, f]))
  const teacherFeedback = new Map((feedbackRows ?? []).filter((f) => f.author_id !== userId).map((f) => [f.booking_id, f]))
  const hasUnseenFeedback = (feedbackRows ?? []).some((f) => f.author_id !== userId && !f.recipient_seen_at)
  const now = new Date()

  const requestedFilter = searchParams.filter ?? 'all'
  const filter = requestedFilter in FILTERS ? requestedFilter : 'all'
  const q = (searchParams.q ?? '').trim().toLowerCase()

  const bookings = (allBookings ?? [])
    .filter((booking) => {
      const allowedStatuses = FILTERS[filter]
      return !allowedStatuses || allowedStatuses.includes(booking.status)
    })
    .filter((booking) => {
      if (!q) return true
      const haystack = `${booking.subject} ${booking.teacher_profiles?.profiles?.full_name ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })

  const hasPendingPayment = (allBookings ?? []).some((booking) => booking.status === 'pending_payment')

  return (
    <main className="container mx-auto px-4 py-12">
      <PendingPaymentRefresher active={hasPendingPayment} />
      {hasUnseenFeedback ? <MarkFeedbackSeen /> : null}
      {searchParams.package === 'success' && !packages.length ? (
        <p className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Payment received. Your package will appear here in a moment; refresh if it doesn&apos;t.
        </p>
      ) : null}
      {packages.length ? <StudentPackages packages={packages} /> : null}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Student bookings</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your lesson history</h1>
        </div>
        <Link href="/student/dashboard" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>

      <form method="get" className="mb-6 grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Input label="Search" name="q" defaultValue={searchParams.q ?? ''} placeholder="Teacher or subject..." />
        <Select
          label="Status"
          name="filter"
          defaultValue={filter}
          options={[
            { value: 'all', label: 'All bookings' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'awaiting', label: 'Awaiting confirmation' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled / declined' },
          ]}
        />
        <Button type="submit">Filter</Button>
      </form>

      <BookingsTable
        counterpartLabel="Teacher"
        emptyMessage={allBookings?.length ? 'No bookings match your filters.' : 'No bookings found. Book a lesson to get started.'}
        rows={bookings.map(
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
          const booking = bookings.find((b) => b.id === row.id)
          if (!booking) return null
          const teacher = booking.teacher_profiles
          const message = statusMessage(booking.status)

          const ended = new Date(booking.end_at) <= now
          if ((booking.status === 'confirmed' && ended) || booking.status === 'completed') {
            const mine = myFeedback.get(booking.id)
            const tags = teacherFeedback.get(booking.id)?.tags ?? []
            return (
              <>
                <FeedbackTags tags={tags} className="justify-end" />
                {/* After a trial, further lessons with this teacher come from a package only. */}
                {booking.is_trial && teacher && !hasPackageWith.has(teacher.id) ? (
                  <Link href={`/teachers/${teacher.id}?intent=package#package`} className="whitespace-nowrap text-sm font-medium text-emerald-700 hover:text-emerald-800">
                    Choose your package to continue
                  </Link>
                ) : null}
                {mine?.status === 'given' && mine.rating ? (
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
                    <RatingStars value={mine.rating} />
                    {mine.visibility === 'public' ? 'Public' : 'Private'}
                  </span>
                ) : teacher ? (
                  <GiveFeedbackButton
                    prompt={{ bookingId: booking.id, role: 'student', otherName: teacher.profiles?.full_name || 'your teacher', subject: booking.subject, startAt: booking.start_at }}
                    className="whitespace-nowrap"
                  />
                ) : null}
              </>
            )
          }

          if (booking.status === 'confirmed') {
            const hoursUntilStart = (new Date(booking.start_at).getTime() - Date.now()) / (60 * 60 * 1000)
            const canCancel = hoursUntilStart >= CANCELLATION_CUTOFF_HOURS
            return (
              <>
                <Link href={`/session/${booking.id}`} title="Join session" className="text-brand-700 hover:text-brand-800">
                  <Video className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href={`/api/bookings/${booking.id}/calendar`} title="Add to calendar" className="text-brand-600 hover:text-brand-700">
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                </a>
                {canCancel ? (
                  <CancelBookingButton bookingId={booking.id} />
                ) : (
                  <span className="text-xs text-slate-400">Can't cancel — starts in &lt;{CANCELLATION_CUTOFF_HOURS}h</span>
                )}
              </>
            )
          }

          return message ? <span className="text-xs text-slate-400">{message}</span> : null
        }}
      />
    </main>
  )
}
