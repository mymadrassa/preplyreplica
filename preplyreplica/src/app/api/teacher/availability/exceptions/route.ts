import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const exceptionSchema = z.object({
  exception_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  kind: z.enum(['available', 'busy', 'vacation']),
})

export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parseResult = exceptionSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }

  const { exception_date, start_time, end_time, kind } = parseResult.data
  if (start_time >= end_time) {
    return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 })
  }

  const { data: exception, error } = await supabase
    .from('availability_exceptions')
    .insert({ teacher_id: userId, exception_date, start_time, end_time, kind })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ exception })
}
