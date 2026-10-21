import type { SupabaseClient } from '@supabase/supabase-js'
import type { MushafLesson } from '@preply-clone/mushaf'

// The lessons (bookings) a student/teacher pair has had, newest first, as the
// filter options for reviewing a Mushaf session's marks lesson by lesson.
// `activeBookingId` is only honoured if it really belongs to the pair.
export async function getPairLessons(
  supabase: SupabaseClient<any, any, any>,
  studentId: string,
  teacherId: string,
  requestedBookingId?: string
): Promise<{ lessons: MushafLesson[]; activeBookingId: string | null }> {
  const { data } = await supabase
    .from('bookings')
    .select('id, subject, start_at')
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .in('status', ['confirmed', 'completed'])
    .order('start_at', { ascending: false })

  const lessons = ((data ?? []) as { id: string; subject: string; start_at: string }[]).map((b) => ({
    id: b.id,
    label: `${b.subject} · ${new Date(b.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
  }))

  const activeBookingId = lessons.some((l) => l.id === requestedBookingId) ? requestedBookingId! : null
  return { lessons, activeBookingId }
}
