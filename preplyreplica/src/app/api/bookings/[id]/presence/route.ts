import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const presenceSchema = z.object({ event: z.enum(['joined', 'left']) })

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parseResult = presenceSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }

  const { data: booking } = await supabase.from('bookings').select('student_id, teacher_id').eq('id', params.id).single()
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const isStudent = booking.student_id === userId
  const isTeacher = booking.teacher_id === userId
  if (!isStudent && !isTeacher) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { event } = parseResult.data
  const now = new Date().toISOString()

  if (event === 'joined') {
    // First join only — a rejoin shouldn't overwrite the original join time,
    // so this update is scoped to rows where the column is still null.
    const column = isStudent ? 'student_joined_at' : 'teacher_joined_at'
    await supabase.from('bookings').update({ [column]: now } as any).eq('id', params.id).is(column, null)
  } else {
    // Always overwrite — reflects the most recent leave, in case of a rejoin.
    const column = isStudent ? 'student_left_at' : 'teacher_left_at'
    await supabase.from('bookings').update({ [column]: now } as any).eq('id', params.id)
  }

  return NextResponse.json({ ok: true })
}
