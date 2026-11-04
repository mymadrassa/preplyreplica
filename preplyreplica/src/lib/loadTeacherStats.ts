import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { statsFromBookings, type TeacherStats } from '@/lib/tiers'

/** One teacher's track record for tiers, from their bookings. */
export async function loadTeacherStats(
  supabase: SupabaseClient<Database>,
  teacher: { id: string; approved_at: string | null; rating_avg: number }
): Promise<TeacherStats> {
  const { data: bookings } = await supabase.from('bookings').select('student_id, status').eq('teacher_id', teacher.id)
  return statsFromBookings(bookings ?? [], { approvedAt: teacher.approved_at, ratingAvg: Number(teacher.rating_avg) })
}
