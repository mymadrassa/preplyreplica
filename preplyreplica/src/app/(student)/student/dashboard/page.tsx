import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, GraduationCap, ListChecks } from 'lucide-react'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { TeacherCard } from '@/components/TeacherCard'
import { PendingPaymentRefresher } from '@/components/PendingPaymentRefresher'
import { UpcomingLessonCard, type UpcomingLesson } from '@/components/UpcomingLessonCard'
import { fetchRankedTeachers } from '@/lib/teacherRecommendations'
import { loadParticipants } from '@/lib/participantNames'
import { syncCheckout } from '@/lib/payments/handleEvent'
import { CLOSES_AFTER_MINUTES } from '@/lib/lessonRoom'
import type { StudentSignal } from '@/lib/recommendation'

export default async function StudentDashboardPage({ searchParams }: { searchParams: { booked?: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) redirect('/auth/login')

  // Back from checkout: settle the payment now rather than waiting for the provider's webhook.
  let justBooked: { teacherId: string; isTrial: boolean } | null = null
  if (searchParams.booked) {
    const { data: booked } = await supabase.from('bookings').select('id, status, teacher_id, is_trial').eq('id', searchParams.booked).eq('student_id', userId).maybeSingle()
    if (booked) {
      justBooked = { teacherId: booked.teacher_id, isTrial: booked.is_trial }
      if (booked.status === 'pending_payment') {
        const db = createSupabaseServiceRoleClient()
        const [{ data: payment }, { data: teacher }] = await Promise.all([
          db.from('payments').select('provider, provider_checkout_id, charge_model').eq('booking_id', booked.id).maybeSingle(),
          db.from('teacher_profiles').select('payout_account_id').eq('id', booked.teacher_id).maybeSingle(),
        ])
        await syncCheckout({ providerId: payment?.provider ?? 'stripe', checkoutId: payment?.provider_checkout_id ?? null, payeeAccountId: payment?.charge_model === 'platform' ? null : (teacher?.payout_account_id ?? null) })
      }
    }
  }

  // Lessons still to come, or on now (the room stays open a while after the end).
  const since = new Date(Date.now() - CLOSES_AFTER_MINUTES * 60_000).toISOString()
  const [{ data: bookings }, { data: preferences }, { data: me }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, teacher_id, subject, start_at, end_at, status, is_trial, package_id')
      .eq('student_id', userId)
      .in('status', ['pending_payment', 'pending', 'confirmed'])
      .gte('end_at', since)
      .order('start_at', { ascending: true })
      .limit(20),
    supabase.from('student_preferences').select('courses, weekly_slots').eq('id', userId).maybeSingle(),
    supabase.from('profiles').select('gender').eq('id', userId).maybeSingle(),
  ])

  const upcoming = bookings ?? []
  const teachers = await loadParticipants(upcoming.map((b) => b.teacher_id))
  const lessons: UpcomingLesson[] = upcoming.map((b) => ({
    id: b.id,
    teacherId: b.teacher_id,
    teacherName: teachers.get(b.teacher_id)?.name ?? 'Your teacher',
    teacherAvatarUrl: teachers.get(b.teacher_id)?.avatarUrl ?? null,
    subject: b.subject,
    startAt: b.start_at,
    endAt: b.end_at,
    status: b.status,
    isTrial: b.is_trial,
    fromPackage: !!b.package_id,
  }))

  // Suggestions below: ranked from the onboarding answers when there are some, otherwise the best-rated.
  const signal: StudentSignal = preferences
    ? { courses: preferences.courses, weeklySlots: (preferences.weekly_slots as StudentSignal['weeklySlots']) ?? [] }
    : { courses: [], weeklySlots: [] }
  const suggestions = (await fetchRankedTeachers(supabase, signal, me?.gender ?? null, 9)).filter((t) => !upcoming.some((b) => b.teacher_id === t.id)).slice(0, 6)

  const justBookedTeacher = justBooked ? (teachers.get(justBooked.teacherId)?.name ?? (await loadParticipants([justBooked.teacherId])).get(justBooked.teacherId)?.name) : null

  return (
    <main className="container mx-auto px-4 py-12">
      <PendingPaymentRefresher active={upcoming.some((b) => b.status === 'pending_payment')} />

      {justBooked ? (
        <div role="status" className="mb-8 flex items-start gap-3 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-5 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="text-lg font-semibold">{justBooked.isTrial ? 'Your trial lesson is booked!' : 'Your lesson is booked!'}</p>
            <p className="mt-1 text-sm">
              {justBooked.isTrial
                ? `Your payment is reserved, not charged yet: it's taken only when ${justBookedTeacher ?? 'your teacher'} confirms the lesson. If they can't, you won't be charged.`
                : `${justBookedTeacher ?? 'Your teacher'} will confirm it soon.`}{' '}
              We&apos;ll email you as soon as it&apos;s confirmed. Your receipt is in{' '}
              <Link href="/student/receipts" className="font-semibold underline">
                Receipts
              </Link>
              .
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Student dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your upcoming lessons</h1>
        </div>
        <Link href="/student/bookings" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50">
          <ListChecks className="h-4 w-4" aria-hidden="true" /> All my lessons
        </Link>
      </div>

      {lessons.length ? (
        <ul className="space-y-3">
          {lessons.map((lesson) => (
            <UpcomingLessonCard key={lesson.id} lesson={lesson} />
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-600">No upcoming lessons yet.</p>
          <Link href="/teachers" className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            <GraduationCap className="h-4 w-4" aria-hidden="true" /> Find a teacher
          </Link>
        </div>
      )}

      {suggestions.length ? (
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Other teachers you might like</h2>
            <Link href="/teachers" className="text-sm font-medium text-brand-600 hover:underline">
              See all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
