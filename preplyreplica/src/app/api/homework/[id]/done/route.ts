import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const schema = z.object({ done: z.boolean() })

/** The student ticks a lesson's homework as done (or undoes it from the history). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  // Students can't write homework rows (RLS), so the server key sets only
  // these fields, only on the caller's own entry. Marking done re-alerts the teacher.
  const { data, error } = await createSupabaseServiceRoleClient()
    .from('lesson_homework')
    .update(parsed.data.done ? { done_at: new Date().toISOString(), teacher_seen_done_at: null } : { done_at: null })
    .eq('id', params.id)
    .eq('student_id', userId)
    .select('done_at')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Homework not found.' }, { status: 404 })
  return NextResponse.json({ doneAt: data.done_at })
}
