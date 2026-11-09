import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { rankTeachersForStudent, type StudentSignal, type TeacherSignal } from '@/lib/recommendation'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { canBeMatched } from '@/lib/gender'
import { isTier, packagePrice, tierRate } from '@/lib/pricing'

export interface RankedTeacher {
  id: string
  full_name: string
  headline: string | null
  rating_avg: number
  hourly_rate: number
  /** What a one-hour lesson costs within this teacher's 10-lesson package. */
  lesson_price: number
  subjects: string[]
  languages: string[]
  status: string
  score: number
}

// Shared by the onboarding wizard's guest-mode recommend-teachers endpoint
// and the signed-in student dashboard's "Recommended for you" section, so
// both read from the same approved+payable teacher pool and the same
// scoring logic rather than drifting apart.
//
// Only teachers of the student's own gender are eligible. That's a hard
// filter applied before ranking, not a signal inside the score, so
// recommendation.ts never sees gender.
export async function fetchRankedTeachers(
  supabase: SupabaseClient<Database>,
  student: StudentSignal,
  studentGender: string | null,
  limit = 20
): Promise<RankedTeacher[]> {
  if (!studentGender) return []
  const { data: teachers } = await supabase.from('teacher_profiles').select('*, profiles(*)').eq('status', 'approved').eq('payments_enabled', true)
  if (!teachers?.length) return []

  // Profiles are private (RLS is owner-only), so genders and names are read with the server key.
  const { data: genders } = await createSupabaseServiceRoleClient().from('profiles').select('id, gender, full_name').in('id', teachers.map((t) => t.id))
  const genderOf = new Map((genders ?? []).map((g) => [g.id, g.gender]))
  const allTeachers = teachers.filter((t) => canBeMatched(studentGender, genderOf.get(t.id)))
  if (!allTeachers.length) return []

  const teacherIds = allTeachers.map((t) => t.id)
  const { data: allSlots } = await supabase.from('availability_slots').select('teacher_id, weekday, start_time, end_time').in('teacher_id', teacherIds)

  // Date-specific exceptions (vacation days, one-off busy blocks) are
  // intentionally not factored into this score -- they'd only ever shave a
  // few points off a teacher's overlap for a date that isn't even a real
  // lesson date yet (this only ever sees a recurring weekly preference).
  // Recurring weekly availability_slots alone is enough signal for ranking.
  const signals: TeacherSignal[] = allTeachers.map((teacher) => ({
    id: teacher.id,
    subjects: teacher.subjects ?? [],
    hourlyRate: tierRate(isTier(teacher.tier) ? teacher.tier : 'starter'),
    ratingAvg: Number(teacher.rating_avg),
    ratingCount: teacher.rating_count,
    availabilitySlots: (allSlots ?? []).filter((s) => s.teacher_id === teacher.id),
    availabilityExceptions: [],
  }))

  const ranked = rankTeachersForStudent(student, signals).slice(0, limit)

  const byId = new Map(allTeachers.map((t) => [t.id, t]))
  return ranked.map((r) => {
    const teacher = byId.get(r.teacherId)!
    return {
      id: teacher.id,
      full_name: genders?.find((g) => g.id === teacher.id)?.full_name || 'Teacher',
      headline: teacher.headline,
      rating_avg: Number(teacher.rating_avg),
      hourly_rate: teacher.hourly_rate,
      lesson_price: packagePrice(isTier(teacher.tier) ? teacher.tier : 'starter').perLesson,
      subjects: teacher.subjects,
      languages: teacher.languages,
      status: teacher.status,
      score: r.score,
    }
  })
}
