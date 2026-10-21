import type { SupabaseClient } from '@supabase/supabase-js'
import type { MushafTables } from './types'

export type MushafClient = SupabaseClient<any, any, any>

export type MushafSession = MushafTables['mushaf_sessions']['Row']

export type MushafSessionResult = { session: MushafSession } | { error: string }

function findSession(supabase: MushafClient, studentId: string, teacherId: string | null) {
  const query = supabase.from('mushaf_sessions').select('*').eq('student_id', studentId)
  return teacherId === null ? query.is('teacher_id', null) : query.eq('teacher_id', teacherId)
}

// Looks up the session, creating it on first open. With a teacherId it's the
// shared (student, teacher) session; with null it's `studentId`'s personal
// revision space (the id is just "the owner" there, so teachers use it too).
// Runs under the caller's own RLS-bound session -- the database, not this
// function, decides whether a shared pair is allowed to have one. Two tabs
// racing to create the same one re-select on the unique violation.
export async function getOrCreateMushafSession(
  supabase: MushafClient,
  studentId: string,
  teacherId: string | null
): Promise<MushafSessionResult> {
  const { data: existing, error: selectError } = await findSession(supabase, studentId, teacherId).maybeSingle()

  if (selectError) return { error: selectError.message }
  if (existing) return { session: existing as MushafSession }

  const { data: created, error: insertError } = await supabase
    .from('mushaf_sessions')
    .insert({ student_id: studentId, teacher_id: teacherId })
    .select('*')
    .single()

  if (!insertError) return { session: created as MushafSession }

  if (insertError.code === '23505') {
    const { data: retried, error: retryError } = await findSession(supabase, studentId, teacherId).single()
    if (retryError) return { error: retryError.message }
    return { session: retried as MushafSession }
  }

  return { error: insertError.message }
}
