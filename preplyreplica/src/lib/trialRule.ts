import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// How lessons with a teacher are booked:
//   1. the first lesson is always the 20-minute trial;
//   2. after it, lessons come from a 10-lesson package (no single paid lessons).
// Lessons booked before this rule existed count as the first lesson.

/** Whether the student has had (or booked) a first lesson with this teacher. Unpaid, cancelled and declined ones don't count. */
export async function hasHadFirstLesson(supabase: SupabaseClient<Database>, studentId: string, teacherId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bookings')
    .select('id')
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .not('status', 'in', '(cancelled,rejected,pending_payment)')
    .limit(1)
    .maybeSingle()
  return !!data
}

export const TRIAL_FIRST_MESSAGE = 'Your first lesson with a teacher is a 20-minute trial.'
export const PACKAGE_REQUIRED_MESSAGE = 'After your trial, lessons with this teacher are booked from a 10-lesson package.'
