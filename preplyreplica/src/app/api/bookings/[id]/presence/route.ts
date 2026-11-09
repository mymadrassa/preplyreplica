import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const presenceSchema = z.object({ event: z.enum(['joined', 'left']) })

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  // Bookings and payments are written only by the server (see migration 0036), after the checks below.
  const db = createSupabaseServiceRoleClient()
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
    // mushaf_sessions belongs to the Mushaf package's schema, not the app's generated types.
    const { data: shared } = await (db as unknown as SupabaseClient)
      .from('mushaf_sessions')
      .select('current_page')
      .eq('student_id', booking.student_id)
      .eq('teacher_id', booking.teacher_id)
      .maybeSingle<{ current_page: number }>()
    if (shared?.current_page) {
      await db.from('lesson_pages').upsert({ booking_id: params.id, page: shared.current_page }, { onConflict: 'booking_id,page', ignoreDuplicates: true })
    }
    // First join only — a rejoin shouldn't overwrite the original join time,
    // so this update is scoped to rows where the column is still null.
    const column = isStudent ? 'student_joined_at' : 'teacher_joined_at'
    await db.from('bookings').update({ [column]: now } as any).eq('id', params.id).is(column, null)
  } else {
    // Always overwrite — reflects the most recent leave, in case of a rejoin.
    const column = isStudent ? 'student_left_at' : 'teacher_left_at'
    await db.from('bookings').update({ [column]: now } as any).eq('id', params.id)
  }

  return NextResponse.json({ ok: true })
}
