import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getOrCreateMushafSession } from '@preply-clone/mushaf'
import { createServerClient } from '@/lib/supabase/server'
import { joinWindow } from '@/lib/lessonRoom'
import { getPairLessons } from '@/lib/mushafLessons'
import { loadHomeworkItems } from '@/lib/homeworkItems'
import { LessonRoom } from '@/components/lesson-room/LessonRoom'
import { RoomOpensCountdown } from '@/components/lesson-room/RoomOpensCountdown'
import { loadParticipants } from '@/lib/participantNames'

/** The live lesson: video with the pair's shared Mushaf, for the booking's student and teacher. */
export default async function SessionPage({ params }: { params: { bookingId: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) redirect('/auth/login')

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, student_id, teacher_id, status, subject, start_at, end_at, teacher_profiles(profiles(full_name)), profiles!student_id(full_name)')
    .eq('id', params.bookingId)
    .maybeSingle()
  if (!booking || (booking.student_id !== userId && booking.teacher_id !== userId)) notFound()

  const role = booking.teacher_id === userId ? 'teacher' : 'student'
  const people = await loadParticipants([booking.teacher_id, booking.student_id])
  const teacherName = people.get(booking.teacher_id)?.name || 'Your teacher'
  const studentName = people.get(booking.student_id)?.name || 'Your student'
  const home = role === 'teacher' ? '/teacher/dashboard' : '/student/bookings'
  const window = joinWindow(booking)

  if (booking.status !== 'confirmed' || window.state !== 'open') {
    return (
      <main className="container mx-auto max-w-lg px-4 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card">
          <h1 className="text-2xl font-semibold text-slate-900">{booking.subject}</h1>
          <p className="mt-1 text-slate-500">
            with {role === 'teacher' ? studentName : teacherName} ·{' '}
            {new Date(booking.start_at).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="mt-6 text-slate-700">
            {booking.status !== 'confirmed' ? (
              <p>This lesson isn’t confirmed, so its room isn’t available.</p>
            ) : window.state === 'too-early' ? (
              <RoomOpensCountdown opensAt={window.opensAt.toISOString()} />
            ) : (
              <p>This lesson has ended.</p>
            )}
          </div>
          <Link href={home} className="mt-6 inline-flex text-sm font-medium text-brand-700 hover:text-brand-800">
            Back
          </Link>
        </div>
      </main>
    )
  }

  // The pair's shared Mushaf, with this lesson's marks tagged to it and the homework panel.
  const [mushaf, { lessons }, homework] = await Promise.all([
    getOrCreateMushafSession(supabase, booking.student_id, booking.teacher_id),
    getPairLessons(supabase, booking.student_id, booking.teacher_id, booking.id),
    loadHomeworkItems(supabase, { studentId: booking.student_id, teacherId: booking.teacher_id }),
  ])
  if ('error' in mushaf) notFound()

  return (
    <LessonRoom
      bookingId={booking.id}
      role={role}
      displayName={role === 'teacher' ? teacherName : studentName}
      otherPartyName={role === 'teacher' ? studentName : teacherName}
      home={home}
      mushaf={{
        sessionId: mushaf.session.id,
        teacherId: booking.teacher_id,
        currentUserId: userId,
        initialPage: mushaf.session.current_page,
        lessons,
        homework: {
          items: homework,
          canTick: role === 'student',
          assign: role === 'teacher' ? { href: `/teacher/homework/${booking.id}`, label: homework.some((h) => h.bookingId === booking.id) ? 'Edit this lesson’s homework' : 'Assign homework' } : null,
        },
      }}
    />
  )
}
