import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAvailableStartTimes } from '@/lib/availability'
import { MIN_BOOKING_NOTICE_HOURS } from '@/lib/constants'

const VALID_DURATIONS = [30, 45, 60, 90]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)

  if (searchParams.get('range') === 'week') {
    return getWeekRange(request, params.id)
  }

  const dateParam = searchParams.get('date')
  const durationParam = Number(searchParams.get('duration'))

  if (!dateParam || !DATE_RE.test(dateParam)) {
    return NextResponse.json({ error: 'A valid date (YYYY-MM-DD) is required' }, { status: 400 })
  }
  if (!VALID_DURATIONS.includes(durationParam)) {
    return NextResponse.json({ error: 'duration must be one of 30, 45, 60, 90' }, { status: 400 })
  }

  const [year, month, day] = dateParam.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  const supabase = createServerClient()
  const [{ data: slots }, { data: exceptions }, { data: bookings }] = await Promise.all([
    supabase.from('availability_slots').select('weekday, start_time, end_time').eq('teacher_id', params.id),
    supabase
      .from('availability_exceptions')
      .select('exception_date, start_time, end_time, exception_type')
      .eq('teacher_id', params.id)
      .eq('exception_date', dateParam),
    supabase
      .from('bookings')
      .select('start_at, end_at, status')
      .eq('teacher_id', params.id)
      .gte('start_at', `${dateParam}T00:00:00`)
      .lte('start_at', `${dateParam}T23:59:59`),
  ])

  const startTimes = getAvailableStartTimes(date, durationParam, slots || [], exceptions || [], bookings || [], MIN_BOOKING_NOTICE_HOURS)

  return NextResponse.json({ startTimes })
}

/**
 * Raw slots/exceptions/bookings for a 7-day window, used by the student-facing
 * booking calendar to render a full week at once instead of one day per request.
 * Booking rows are trimmed to just start/end/status — no student name/email —
 * since this endpoint is public (any signed-in student viewing the teacher).
 */
async function getWeekRange(request: Request, teacherId: string) {
  const { searchParams } = new URL(request.url)
  const weekStartParam = searchParams.get('weekStart')
  if (!weekStartParam || !DATE_RE.test(weekStartParam)) {
    return NextResponse.json({ error: 'A valid weekStart (YYYY-MM-DD) is required' }, { status: 400 })
  }

  const [year, month, day] = weekStartParam.split('-').map(Number)
  const weekStart = new Date(year, month - 1, day)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const supabase = createServerClient()
  const [{ data: slots }, { data: exceptions }, { data: bookings }] = await Promise.all([
    supabase.from('availability_slots').select('weekday, start_time, end_time').eq('teacher_id', teacherId),
    supabase
      .from('availability_exceptions')
      .select('exception_date, start_time, end_time, exception_type')
      .eq('teacher_id', teacherId)
      .gte('exception_date', weekStartParam)
      .lt('exception_date', weekEnd.toISOString().slice(0, 10)),
    supabase
      .from('bookings')
      .select('start_at, end_at, status')
      .eq('teacher_id', teacherId)
      .gte('start_at', `${weekStartParam}T00:00:00`)
      .lt('start_at', `${weekEnd.toISOString().slice(0, 10)}T00:00:00`),
  ])

  return NextResponse.json({
    slots: slots || [],
    exceptions: exceptions || [],
    bookings: bookings || [],
    minNoticeHours: MIN_BOOKING_NOTICE_HOURS,
  })
}
