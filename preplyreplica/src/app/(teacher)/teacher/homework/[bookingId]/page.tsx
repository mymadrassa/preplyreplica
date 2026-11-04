import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { formatRange, rangeFromRow } from '@/lib/homework'
import { getSurahs } from '@/lib/surahs'
import { HomeworkForm } from './HomeworkForm'

export default async function TeacherHomeworkPage({ params, searchParams }: { params: { bookingId: string }; searchParams: { back?: string } }) {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/login')

  const [{ data: booking }, { data: entry }, surahs] = await Promise.all([
    supabase.from('bookings').select('id, teacher_id, student_id, start_at, subject, status, profiles!student_id(full_name)').eq('id', params.bookingId).maybeSingle(),
    supabase.from('lesson_homework').select('*').eq('booking_id', params.bookingId).maybeSingle(),
    getSurahs(),
  ])
  if (!booking || booking.teacher_id !== userId) notFound()

  // The student's phone is private to them; the server only checks whether one exists.
  const [{ data: studentContact }, { data: history }] = await Promise.all([
    createSupabaseServiceRoleClient().from('profiles').select('phone').eq('id', booking.student_id).maybeSingle(),
    supabase
      .from('lesson_homework')
      .select('*, bookings(start_at)')
      .eq('teacher_id', userId)
      .eq('student_id', booking.student_id)
      .neq('booking_id', booking.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const studentName = (booking.profiles as { full_name: string | null } | null)?.full_name || 'Student'
  const canSet = booking.status === 'confirmed' || booking.status === 'completed'
  // Only ever back into this student's Mushaf, never an arbitrary URL.
  const backToMushaf = searchParams.back === `/teacher/mushaf/${booking.student_id}` ? searchParams.back : null

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <Link href={backToMushaf ?? '/teacher/dashboard'} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backToMushaf ? 'Back to the Mushaf' : 'Back to dashboard'}
      </Link>
      <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Cahier de texte</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Homework for {studentName}</h1>
      <p className="mt-2 text-slate-600">
        {booking.subject} · {new Date(booking.start_at).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}
      </p>
      <p className="mt-1 text-sm">
        <Link href={`/teacher/students/${booking.student_id}`} className="font-medium text-brand-700 hover:text-brand-800">
          See {studentName}&apos;s follow-up
        </Link>
        {entry?.done_at ? (
          <span className="ml-3 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            Done {new Date(entry.done_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        ) : null}
      </p>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        {canSet ? (
          <HomeworkForm
            bookingId={booking.id}
            surahs={surahs}
            studentHasPhone={!!studentContact?.phone}
            initial={
              entry
                ? {
                    revision: rangeFromRow(entry, 'revision'),
                    memorization: rangeFromRow(entry, 'memorization'),
                    note: entry.note,
                  }
                : null
            }
            delivery={
              entry
                ? { channel: entry.sent_channel, status: entry.delivery_status, error: entry.last_error, sentAt: entry.sent_at, seenAt: entry.student_seen_at }
                : null
            }
          />
        ) : (
          <p className="text-sm text-slate-600">Homework can be set once the lesson is confirmed.</p>
        )}
      </div>

      {history?.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Earlier homework for {studentName}</h2>
          <ul className="mt-4 space-y-3">
            {history.map((item) => (
              <li key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <p className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  {new Date((item.bookings as { start_at: string } | null)?.start_at ?? item.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  {item.done_at ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">Done</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">Waiting</span>
                  )}
                </p>
                <p className="mt-1 text-slate-700">
                  <strong>Revision:</strong> {formatRange(rangeFromRow(item, 'revision'), surahs)}
                </p>
                <p className="text-slate-700">
                  <strong>New memorisation:</strong> {formatRange(rangeFromRow(item, 'memorization'), surahs)}
                </p>
                {item.note ? <p className="mt-1 text-slate-500">{item.note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
