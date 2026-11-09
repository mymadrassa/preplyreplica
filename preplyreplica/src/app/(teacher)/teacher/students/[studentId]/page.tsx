import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BookOpen, MessageCircle } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/Avatar'
import { formatRate, summarizeFollowUp } from '@/lib/homeworkFollowUp'
import { loadHomeworkItems } from '@/lib/homeworkItems'
import { MarkDoneSeen } from './MarkDoneSeen'
import { RatingStars } from '@/components/RatingStars'
import { FeedbackTags } from '@/components/FeedbackTags'
import { GiveFeedbackButton } from '@/components/SessionFeedbackPrompt'
import { MarkFeedbackSeen } from '@/components/MarkFeedbackSeen'
import { CriteriaAverages } from '@/components/CriteriaAverages'
import { describeCriteria } from '@/lib/sessionFeedback'
import { formatPageRanges, pagesByBooking } from '@/lib/lessonPages'

export default async function StudentFollowUpPage({ params }: { params: { studentId: string } }) {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/login')

  const [{ data: student }, { data: bookings }, { data: homeworkRows }, items, { data: conversation }, { data: feedbackRows }] = await Promise.all([
    supabase.from('profiles').select('full_name, email, avatar_url').eq('id', params.studentId).maybeSingle(),
    supabase
      .from('bookings')
      .select('id, start_at, end_at, subject, status')
      .eq('teacher_id', userId)
      .eq('student_id', params.studentId)
      .in('status', ['confirmed', 'completed'])
      .order('start_at', { ascending: false }),
    supabase.from('lesson_homework').select('booking_id, done_at, teacher_seen_done_at').eq('teacher_id', userId).eq('student_id', params.studentId),
    loadHomeworkItems(supabase, { teacherId: userId, studentId: params.studentId }, 200),
    supabase.from('conversations').select('id').eq('teacher_id', userId).eq('student_id', params.studentId).maybeSingle(),
    supabase
      .from('session_feedback')
      .select('booking_id, author_id, status, rating, comment, visibility, tags, criteria, outcome, recipient_seen_at')
      .or(`and(author_id.eq.${userId},recipient_id.eq.${params.studentId}),and(author_id.eq.${params.studentId},recipient_id.eq.${userId})`),
  ])
  // Only students this teacher actually teaches.
  if (!bookings?.length) notFound()

  const name = student?.full_name || student?.email || 'Student'
  const summary = summarizeFollowUp(bookings, homeworkRows ?? [])
  const byBooking = new Map(items.map((item) => [item.bookingId, item]))
  const now = new Date()
  const { data: pageRows } = await supabase.from('lesson_pages').select('booking_id, page').in('booking_id', bookings.map((b) => b.id))
  const lessonPages = pagesByBooking(pageRows ?? [])
  const fromStudent = new Map((feedbackRows ?? []).filter((f) => f.author_id === params.studentId && f.status === 'given').map((f) => [f.booking_id, f]))
  const mine = new Map((feedbackRows ?? []).filter((f) => f.author_id === userId).map((f) => [f.booking_id, f]))
  const hasUnseenFeedback = [...fromStudent.values()].some((f) => !f.recipient_seen_at)
  const stats: [string, string][] = [
    ['Lessons', String(summary.lessons)],
    ['Homework given', String(summary.given)],
    ['Done', `${summary.done} (${formatRate(summary.completionRate)})`],
    ['On time', formatRate(summary.onTimeRate)],
  ]

  return (
    <main className="container mx-auto max-w-4xl px-4 py-12">
      {summary.unseenDone ? <MarkDoneSeen studentId={params.studentId} /> : null}
      {hasUnseenFeedback ? <MarkFeedbackSeen authorId={params.studentId} /> : null}
      <Link href="/teacher/students" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> My students
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={name} avatarUrl={student?.avatar_url ?? null} size="md" className="h-14 w-14 text-lg" />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Follow-up</p>
            <h1 className="text-3xl font-semibold text-slate-900">{name}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/teacher/mushaf/${params.studentId}`} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <BookOpen className="h-4 w-4" aria-hidden="true" /> Open Mushaf
          </Link>
          <Link
            href={conversation ? `/teacher/messages/${conversation.id}` : '/teacher/messages'}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Message
          </Link>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <CriteriaAverages role="teacher" title="Your ratings" scores={[...mine.values()].filter((f) => f.status === 'given' && f.outcome === 'ok').map((f) => f.criteria)} />
      </div>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">Lessons</h2>
      <ol className="mt-4 space-y-3">
        {bookings.map((booking) => {
          const item = byBooking.get(booking.id)
          const upcoming = new Date(booking.start_at) > now
          return (
            <li key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {new Date(booking.start_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  <span className="ml-2 font-normal text-slate-500">{booking.subject}</span>
                  {lessonPages.get(booking.id)?.length ? (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">{formatPageRanges(lessonPages.get(booking.id)!)}</span>
                  ) : null}
                </p>
                <div className="flex items-center gap-3">
                  {item ? (
                    item.doneAt ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        Done {new Date(item.doneAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Waiting</span>
                    )
                  ) : (
                    <span className="text-xs text-slate-400">{upcoming ? 'Upcoming' : 'No homework'}</span>
                  )}
                  <Link href={`/teacher/homework/${booking.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                    {item ? 'Edit' : 'Set homework'}
                  </Link>
                </div>
              </div>
              {item ? (
                <div className="mt-2 space-y-0.5 text-sm text-slate-700">
                  {item.revision ? (
                    <p>
                      <strong>Revision:</strong> {item.revision.label}
                    </p>
                  ) : null}
                  {item.memorization ? (
                    <p>
                      <strong>New memorisation:</strong> {item.memorization.label}
                    </p>
                  ) : null}
                  {item.note ? <p className="text-slate-500">{item.note}</p> : null}
                </div>
              ) : null}
              {!upcoming ? (
                <LessonFeedback
                  student={fromStudent.get(booking.id) ?? null}
                  mine={mine.get(booking.id) ?? null}
                  prompt={{ bookingId: booking.id, role: 'teacher', otherName: name, subject: booking.subject, startAt: booking.start_at, endAt: booking.end_at }}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </main>
  )
}

type FeedbackRow = { rating: number | null; comment: string | null; visibility: 'public' | 'private' | null; tags: string[]; criteria: Record<string, number>; outcome: 'ok' | 'reported'; status: 'given' | 'skipped' }

/** Both sides' feedback on one lesson: the student's (stars, comment, visibility) and the teacher's own tags. */
function LessonFeedback({ student, mine, prompt }: { student: FeedbackRow | null; mine: FeedbackRow | null; prompt: React.ComponentProps<typeof GiveFeedbackButton>['prompt'] }) {
  return (
    <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Student&apos;s feedback</p>
        {student?.rating ? (
          <div className="mt-1 space-y-1">
            <span className="flex items-center gap-2">
              <RatingStars value={student.rating} />
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{student.visibility === 'public' ? 'Public' : 'Private'}</span>
            </span>
            {student.comment ? <p className="text-slate-600">{student.comment}</p> : null}
          </div>
        ) : (
          <p className="mt-1 text-slate-400">None yet</p>
        )}
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your feedback</p>
        {mine?.status === 'given' ? (
          mine.outcome === 'reported' ? (
            <p className="mt-1 text-amber-700">Problem reported</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-500">
                {describeCriteria('teacher', mine.criteria)
                  .map((c) => `${c.label.split(' (')[0]} ${c.score}/5`)
                  .join(' · ')}
              </p>
              <FeedbackTags tags={mine.tags} className="mt-1 justify-end" />
            </>
          )
        ) : (
          <GiveFeedbackButton prompt={prompt} className="mt-1" />
        )}
      </div>
    </div>
  )
}
