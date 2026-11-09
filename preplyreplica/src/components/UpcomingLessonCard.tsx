import Link from 'next/link'
import { CalendarPlus, Clock, Gift, Package, Video } from 'lucide-react'
import { Avatar } from '@/components/Avatar'

export interface UpcomingLesson {
  id: string
  teacherId: string
  teacherName: string
  teacherAvatarUrl: string | null
  subject: string
  startAt: string
  endAt: string
  status: string
  isTrial: boolean
  fromPackage: boolean
}

/**
 * One upcoming lesson on the student's dashboard: who, when, and the Join
 * button, which is active once the teacher has confirmed the lesson.
 */
export function UpcomingLessonCard({ lesson }: { lesson: UpcomingLesson }) {
  const start = new Date(lesson.startAt)
  const confirmed = lesson.status === 'confirmed'
  const minutes = Math.round((new Date(lesson.endAt).getTime() - start.getTime()) / 60000)

  const statusLine =
    lesson.status === 'pending_payment'
      ? { text: 'Confirming your payment…', className: 'text-slate-500' }
      : lesson.status === 'pending'
        ? { text: `Waiting for ${lesson.teacherName} to confirm`, className: 'text-amber-700' }
        : { text: 'Confirmed', className: 'text-emerald-700' }

  return (
    <li className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <Link href={`/teachers/${lesson.teacherId}`} className="flex-shrink-0">
          <Avatar name={lesson.teacherName} avatarUrl={lesson.teacherAvatarUrl} size="md" className="h-14 w-14 text-lg" />
        </Link>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
            {lesson.teacherName}
            {lesson.isTrial ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                <Gift className="h-3 w-3" aria-hidden="true" /> Trial
              </span>
            ) : lesson.fromPackage ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                <Package className="h-3 w-3" aria-hidden="true" /> Package
              </span>
            ) : null}
          </p>
          <p className="text-sm text-slate-600">
            {start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
            {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {minutes} min · {lesson.subject}
          </p>
          <p className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${statusLine.className}`}>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {statusLine.text}
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {confirmed ? (
          <a
            href={`/api/bookings/${lesson.id}/calendar`}
            title="Add to my calendar"
            aria-label="Add to my calendar"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
        {confirmed ? (
          <Link href={`/session/${lesson.id}`} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
            <Video className="h-4 w-4" aria-hidden="true" /> Join the lesson
          </Link>
        ) : (
          <span
            aria-disabled="true"
            title={lesson.status === 'pending' ? `Available once ${lesson.teacherName} confirms` : 'Available once your payment is confirmed'}
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500"
          >
            <Video className="h-4 w-4" aria-hidden="true" /> Join the lesson
          </span>
        )}
      </div>
    </li>
  )
}
