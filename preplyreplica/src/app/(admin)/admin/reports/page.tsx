import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { loadParticipants } from '@/lib/participantNames'
import { reportReasonLabel } from '@/lib/sessionFeedback'
import { formatBookingDateTime } from '@/lib/format'
import { RESOLUTION_LABELS } from '@/lib/lessonReports'

/** Reported lessons: open ones first (their payouts are on hold), then the latest decisions. */
export default async function AdminReportsPage() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user?.id) redirect('/auth/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  if (me?.role !== 'admin') notFound()

  const db = createSupabaseServiceRoleClient()
  const [{ data: open }, { data: resolved }] = await Promise.all([
    db.from('lesson_reports').select('*, bookings(subject, start_at, student_id, teacher_id)').eq('status', 'open').order('created_at', { ascending: true }),
    db.from('lesson_reports').select('*, bookings(subject, start_at, student_id, teacher_id)').eq('status', 'resolved').order('resolved_at', { ascending: false }).limit(30),
  ])
  const all = [...(open ?? []), ...(resolved ?? [])]
  const people = await loadParticipants(all.flatMap((r) => (r.bookings ? [r.bookings.student_id, r.bookings.teacher_id] : [])))
  const name = (id: string | undefined) => (id ? (people.get(id)?.name ?? '—') : '—')

  const row = (report: (typeof all)[number]) => (
    <li key={report.id}>
      <Link href={`/admin/reports/${report.booking_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{reportReasonLabel(report.reason, report.reporter_role)}</p>
          <p className="text-sm text-slate-600">
            {report.bookings?.subject} · {report.bookings ? formatBookingDateTime(report.bookings.start_at) : ''} · {name(report.bookings?.teacher_id)} (teacher) with {name(report.bookings?.student_id)} (student)
          </p>
          <p className="mt-1 line-clamp-1 text-sm text-slate-500">
            Reported by the {report.reporter_role}: “{report.detail}”
          </p>
        </div>
        {report.status === 'open' ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Payout on hold · {formatBookingDateTime(report.created_at)}</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{report.resolution ? RESOLUTION_LABELS[report.resolution] : 'Resolved'}</span>
        )}
      </Link>
    </li>
  )

  return (
    <main className="container mx-auto max-w-4xl px-4 py-12">
      <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Admin</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Lesson reports</h1>
      <p className="mt-2 text-slate-600">A report holds the lesson&apos;s payout until you decide: pay the teacher, refund the student, or refund part of it.</p>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" /> To resolve ({open?.length ?? 0})
        </h2>
        {open?.length ? <ul className="mt-4 space-y-3">{open.map(row)}</ul> : <p className="mt-3 text-slate-500">Nothing to resolve.</p>}
      </section>

      {resolved?.length ? (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /> Recently resolved
          </h2>
          <ul className="mt-4 space-y-3">{resolved.map(row)}</ul>
        </section>
      ) : null}
    </main>
  )
}
