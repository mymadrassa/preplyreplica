import { NextResponse } from 'next/server'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'

/** The student opened their cahier de texte: their unread entries stop showing in the bell. */
export async function POST() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Students can't write homework rows themselves (RLS), so the server key sets
  // only this one field, only on the caller's own entries.
  const { error } = await createSupabaseServiceRoleClient()
    .from('lesson_homework')
    .update({ student_seen_at: new Date().toISOString() })
    .eq('student_id', userId)
    .is('student_seen_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
