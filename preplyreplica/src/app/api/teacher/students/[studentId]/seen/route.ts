import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/** The teacher opened a student's follow-up: that student's finished homework leaves the bell. */
export async function POST(_request: Request, { params }: { params: { studentId: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('lesson_homework')
    .update({ teacher_seen_done_at: new Date().toISOString() })
    .eq('teacher_id', userId)
    .eq('student_id', params.studentId)
    .not('done_at', 'is', null)
    .is('teacher_seen_done_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
