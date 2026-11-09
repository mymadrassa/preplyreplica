import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { loadParticipants } from '@/lib/participantNames'
import { describeCriteria, describeTags, reportReasonLabel, type FeedbackRole } from '@/lib/sessionFeedback'
import { formatBookingDateTime } from '@/lib/format'
import { toPounds } from '@/lib/pricing'
import { RESOLUTION_LABELS } from '@/lib/lessonReports'
import { RatingStars } from '@/components/RatingStars'
import { ResolveReportForm } from './ResolveReportForm'

function time(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
}

/** One reported lesson: who said what, when each side was in the room, the money, and the decision. */
export default async function AdminReportPage({ params }: { params: { bookingId: string } }) {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user?.id) redirect('/auth/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (me?.role !== 'admin') notFound()

  const db = createSupabaseServiceRoleClient()
  const { data: booking } = await db.from('bookings').select('*').eq('id', params.bookingId).maybeSingle()
  if (!booking) notFound()
  const [{ data: reports }, { data: feedback }, { data: payment }, { data: pkg }, people] = await Promise.all([
    db.from('lesson_reports').select('*').eq('booking_id', booking.id).order('created_at', { ascending: true }),
    db.from('session_feedback').select('*').eq('booking_id', booking.id),
    booking.package_id ? Promise.resolve({ data: null }) : db.from('payments').select('id, amount, teacher_fee, status').eq('booking_id', booking.id).maybeSingle(),
    booking.package_id ? db.from('lesson_packages').select('teacher_fee_per_lesson, lessons_total').eq('id', booking.package_id).maybeSingle() : Promise.resolve({ data: null }),
    loadParticipants([booking.student_id, booking.teacher_id]),
  ])
  if (!reports?.length) notFound()

  const studentName = people.get(booking.student_id)?.name ?? 'Student'
  const teacherName = people.get(booking.teacher_id)?.name ?? 'Teacher'
  const nameOf = (role: FeedbackRole) => (role === 'student' ? studentName : teacherName)
  const open = reports.some((r) => r.status === 'open')
  const decided = reports.find((r) => r.status === 'resolved')
  const teacherShare = booking.payout_amount ?? (pkg ? pkg.teacher_fee_per_lesson : (payment?.teacher_fee ?? null))

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <Link href="/admin/reports" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All reports
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-slate-900">{booking.subject}</h1>
      <p className="mt-1 text-slate-600">
        {formatBookingDateTime(booking.start_at)} · {teacherName} (teacher) with {studentName} (student){booking.is_trial ? ' · Trial' : booking.package_id ? ' · Package lesson' : ''}
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
        {reports.map((report) => (
          <div key={report.id} className={`rounded-2xl border p-4 ${report.status === 'open' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <p className="font-semibold text-slate-900">{reportReasonLabel(report.reason, report.reporter_role)}</p>
            <p className="text-xs text-slate-500">
              By {nameOf(report.reporter_role)} ({report.reporter_role}) · {formatBookingDateTime(report.created_at)}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{report.detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">In the room</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">Planned</dt>
            <dd className="text-slate-900">
              {time(booking.start_at)} → {time(booking.end_at)}
            </dd>
            <dt className="text-slate-500">Teacher</dt>
            <dd className="text-slate-900">
              {time(booking.teacher_joined_at)} → {time(booking.teacher_left_at)}
            </dd>
            <dt className="text-slate-500">Student</dt>
            <dd className="text-slate-900">
              {time(booking.student_joined_at)} → {time(booking.student_left_at)}
            </dd>
          </dl>
          <p className="mt-2 text-xs text-slate-400">First join and last leave recorded by the lesson room.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Money</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {payment ? (
              <>
                <dt className="text-slate-500">Student paid</dt>
                <dd className="text-slate-900">
                  £{toPounds(payment.amount).toFixed(2)} ({payment.status})
                </dd>
              </>
            ) : pkg ? (
              <>
                <dt className="text-slate-500">Paid by</dt>
                <dd className="text-slate-900">Package of {pkg.lessons_total} lessons</dd>
              </>
            ) : null}
            <dt className="text-slate-500">Teacher share</dt>
            <dd className="text-slate-900">{teacherShare != null ? `£${toPounds(teacherShare).toFixed(2)}` : '—'}</dd>
            <dt className="text-slate-500">Payout</dt>
            <dd className="text-slate-900">{booking.payout_state}</dd>
          </dl>
          {payment || booking.package_id ? (
            <Link href={payment ? `/receipts/payment/${payment.id}` : `/receipts/package/${booking.package_id}`} className="mt-2 inline-flex text-sm font-medium text-brand-700 hover:text-brand-800">
              Open the student&apos;s receipt
            </Link>
          ) : null}
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Post-lesson feedback</h2>
        {(['student', 'teacher'] as const).map((role) => {
          const f = feedback?.find((row) => row.author_role === role)
          return (
            <div key={role} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <p className="font-semibold text-slate-900">
                {nameOf(role)} ({role})
              </p>
              {!f ? (
                <p className="text-slate-500">No answer yet.</p>
              ) : f.status === 'skipped' ? (
                <p className="text-slate-500">Skipped.</p>
              ) : f.outcome === 'reported' ? (
                <p className="text-amber-800">Reported a problem (above).</p>
              ) : (
                <div className="mt-1 space-y-1 text-slate-700">
                  <p className="text-emerald-700">Everything went well</p>
                  {f.rating ? <RatingStars value={f.rating} /> : null}
                  <ul>
                    {describeCriteria(role, f.criteria).map((c) => (
                      <li key={c.key}>
                        {c.label}: {c.score}/5
                      </li>
                    ))}
                  </ul>
                  {f.tags.length ? <p>{describeTags(f.tags).map((t) => t.label).join(', ')}</p> : null}
                  {f.comment ? <p className="italic">“{f.comment}”</p> : null}
                </div>
              )}
            </div>
          )
        })}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Decision</h2>
        {open ? (
          <ResolveReportForm bookingId={booking.id} isPackage={!!booking.package_id} paidPence={payment?.amount ?? null} />
        ) : decided ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {decided.resolution ? RESOLUTION_LABELS[decided.resolution] : 'Resolved'}
              {decided.refund_amount ? ` · £${toPounds(decided.refund_amount).toFixed(2)} refunded` : ''}
            </p>
            <p className="text-xs text-slate-500">{decided.resolved_at ? formatBookingDateTime(decided.resolved_at) : ''}</p>
            {decided.admin_note ? <p className="mt-2 whitespace-pre-line">{decided.admin_note}</p> : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
