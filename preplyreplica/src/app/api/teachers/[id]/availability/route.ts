import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getAvailableStartTimes } from '@/lib/availability'

const VALID_DURATIONS = [30, 45, 60, 90]

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')
  const durationParam = Number(searchParams.get('duration'))

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
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

  const startTimes = getAvailableStartTimes(date, durationParam, slots || [], exceptions || [], bookings || [])

  return NextResponse.json({ startTimes })
}
