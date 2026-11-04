import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, MessageCircle } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/Avatar'
import { formatRate, summarizeFollowUp } from '@/lib/homeworkFollowUp'

export default async function TeacherStudentsPage() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/login')

  const [{ data: bookings }, { data: homework }, { data: conversations }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, start_at, student_id, profiles!student_id(full_name, email, avatar_url)')
      .eq('teacher_id', userId)
      .in('status', ['confirmed', 'completed']),
    supabase.from('lesson_homework').select('student_id, booking_id, done_at, teacher_seen_done_at').eq('teacher_id', userId),
    supabase.from('conversations').select('id, student_id').eq('teacher_id', userId),
  ])

  // One row per student taught, most recent lesson first.
  const students = new Map<string, { name: string; avatarUrl: string | null; lessons: { id: string; start_at: string }[] }>()
  for (const booking of bookings ?? []) {
    const profile = booking.profiles as { full_name: string | null; email: string | null; avatar_url: string | null } | null
    const entry = students.get(booking.student_id) ?? { name: profile?.full_name || profile?.email || 'Student', avatarUrl: profile?.avatar_url ?? null, lessons: [] }
    entry.lessons.push({ id: booking.id, start_at: booking.start_at })
    students.set(booking.student_id, entry)
  }
  const rows = [...students.entries()]
    .map(([id, s]) => ({
      id,
      ...s,
      summary: summarizeFollowUp(s.lessons, (homework ?? []).filter((h) => h.student_id === id)),
      conversationId: conversations?.find((c) => c.student_id === id)?.id ?? null,
    }))
    .sort((a, b) => (b.summary.lastLessonAt ?? '').localeCompare(a.summary.lastLessonAt ?? ''))

  return (
    <main className="container mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-slate-900">My students</h1>
      <p className="mt-2 text-slate-600">How each student is keeping up with their homework.</p>

      {rows.length ? (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Lessons</th>
                <th className="px-4 py-3">Last lesson</th>
                <th className="px-4 py-3">Homework</th>
                <th className="px-4 py-3">Done</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="align-middle hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/teacher/students/${row.id}`} className="flex items-center gap-2.5 font-medium text-slate-900 hover:opacity-80">
                      <Avatar name={row.name} avatarUrl={row.avatarUrl} />
                      {row.name}
                      {row.summary.unseenDone ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">{row.summary.unseenDone} new done</span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.summary.lessons}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {row.summary.lastLessonAt ? new Date(row.summary.lastLessonAt).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.summary.given ? `${row.summary.open} open · ${row.summary.done} done` : 'None yet'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatRate(row.summary.completionRate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/teacher/students/${row.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                        Follow-up
                      </Link>
                      <Link href={`/teacher/mushaf/${row.id}`} title="Open Mushaf" className="text-slate-500 hover:text-slate-700">
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <Link href={row.conversationId ? `/teacher/messages/${row.conversationId}` : '/teacher/messages'} title="Message" className="text-slate-500 hover:text-slate-700">
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Students appear here once you have a confirmed lesson with them.</p>
      )}
    </main>
  )
}
