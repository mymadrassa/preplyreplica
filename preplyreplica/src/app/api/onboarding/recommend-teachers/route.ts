import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { fetchRankedTeachers } from '@/lib/teacherRecommendations'

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
// account exists, so this can't require auth. Ranking logic lives in
// src/lib/teacherRecommendations.ts, shared with the student dashboard's
// "Recommended for you" section.
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
      weeklySlots = z.array(weeklySlotSchema).parse(JSON.parse(parseResult.data.weeklySlots))
    } catch {
      return NextResponse.json({ error: 'Invalid weeklySlots' }, { status: 400 })
    }
  }

  const supabase = createServerClient()
  const teachers = await fetchRankedTeachers(supabase, { courses, weeklySlots, maxHourlyRate: parseResult.data.maxHourlyRate }, RESULT_LIMIT)

  return NextResponse.json({ teachers })
}
