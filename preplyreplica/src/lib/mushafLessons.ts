import type { SupabaseClient } from '@supabase/supabase-js'
import type { MushafLesson } from '@preply-clone/mushaf'

// The lessons (bookings) a student/teacher pair has had, newest first, as the
// filter options for reviewing a Mushaf session's marks lesson by lesson.
// `activeBookingId` is only honoured if it really belongs to the pair.
// `currentLessonId` is the lesson the session is about: the requested one, else
// the latest that has already started (what homework is set for).
export async function getPairLessons(
  supabase: SupabaseClient<any, any, any>,
  studentId: string,
  teacherId: string,
  requestedBookingId?: string
): Promise<{ lessons: MushafLesson[]; activeBookingId: string | null; currentLessonId: string | null }> {
  const { data } = await supabase
    .from('bookings')
    .select('id, subject, start_at')
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .in('status', ['confirmed', 'completed'])
    .order('start_at', { ascending: false })

  const rows = (data ?? []) as { id: string; subject: string; start_at: string }[]
  const lessons = rows.map((b) => ({
    id: b.id,
    label: `${b.subject} · ${new Date(b.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
  }))

  const activeBookingId = lessons.some((l) => l.id === requestedBookingId) ? requestedBookingId! : null
  const now = new Date().toISOString()
  const currentLessonId = activeBookingId ?? rows.find((b) => b.start_at <= now)?.id ?? null
  return { lessons, activeBookingId, currentLessonId }
}
