import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { rankTeachersForStudent, type TeacherSignal } from '@/lib/recommendation'

const querySchema = z.object({
  courses: z.string().optional(),
  weeklySlots: z.string().optional(),
  maxHourlyRate: z.coerce.number().optional(),
})

const weeklySlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
})

const RESULT_LIMIT = 20

// Guest-accessible: the wizard's teacher-selection step runs before an
// account exists, so this can't require auth. Reuses the same base query as
// the public /teachers catalog (approved + payable), then ranks with
// rankTeachersForStudent instead of the catalog's plain rating sort.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parseResult = querySchema.safeParse({
    courses: searchParams.get('courses') ?? undefined,
    weeklySlots: searchParams.get('weeklySlots') ?? undefined,
    maxHourlyRate: searchParams.get('maxHourlyRate') ?? undefined,
  })
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }

  const courses = parseResult.data.courses ? parseResult.data.courses.split(',').filter(Boolean) : []
  let weeklySlots: { weekday: number; start_time: string; end_time: string }[] = []
  if (parseResult.data.weeklySlots) {
    try {
      const parsedSlots = z.array(weeklySlotSchema).parse(JSON.parse(parseResult.data.weeklySlots))
      weeklySlots = parsedSlots
    } catch {
      return NextResponse.json({ error: 'Invalid weeklySlots' }, { status: 400 })
    }
  }

  const supabase = createServerClient()
  const { data: teachers } = await supabase
    .from('teacher_profiles')
    .select('*, profiles(*)')
    .eq('status', 'approved')
    .eq('stripe_charges_enabled', true)

  const allTeachers = teachers ?? []
  if (!allTeachers.length) {
    return NextResponse.json({ teachers: [] })
  }

  const teacherIds = allTeachers.map((t) => t.id)
  const [{ data: allSlots }, { data: allExceptions }] = await Promise.all([
    supabase.from('availability_slots').select('teacher_id, weekday, start_time, end_time').in('teacher_id', teacherIds),
    supabase.from('availability_exceptions').select('teacher_id, exception_date, start_time, end_time, kind').in('teacher_id', teacherIds),
  ])

  const signals: TeacherSignal[] = allTeachers.map((teacher) => ({
    id: teacher.id,
    subjects: teacher.subjects ?? [],
    hourlyRate: teacher.hourly_rate,
    ratingAvg: Number(teacher.rating_avg),
    ratingCount: teacher.rating_count,
    availabilitySlots: (allSlots ?? []).filter((s) => s.teacher_id === teacher.id),
    availabilityExceptions: (allExceptions ?? []).filter((e) => e.teacher_id === teacher.id),
  }))

  const ranked = rankTeachersForStudent({ courses, weeklySlots, maxHourlyRate: parseResult.data.maxHourlyRate }, signals).slice(0, RESULT_LIMIT)

  const byId = new Map(allTeachers.map((t) => [t.id, t]))
  const results = ranked.map((r) => {
    const teacher = byId.get(r.teacherId)!
    return {
      id: teacher.id,
      full_name: teacher.profiles?.full_name ?? 'Teacher',
      headline: teacher.headline,
      rating_avg: Number(teacher.rating_avg),
      hourly_rate: teacher.hourly_rate,
      subjects: teacher.subjects,
      languages: teacher.languages,
      status: teacher.status,
      score: r.score,
    }
  })

  return NextResponse.json({ teachers: results })
}
