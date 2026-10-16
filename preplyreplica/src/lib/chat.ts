import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type ConversationResult = { id: string } | { error: string }

// Looks up the (student, teacher) conversation, creating it on first
// contact. Runs under the caller's own RLS-bound session -- works from
// either the student's or the teacher's browser client, since
// `conversations_participants` allows either side to read/insert their own
// pair. Two tabs racing to create the same pair is handled by re-selecting
// on the unique-constraint violation rather than failing.
export async function getOrCreateConversation(
  supabase: SupabaseClient<Database>,
  studentId: string,
  teacherId: string
): Promise<ConversationResult> {
  const { data: existing, error: selectError } = await supabase
    .from('conversations')
    .select('id')
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .maybeSingle()

  if (selectError) return { error: selectError.message }
  if (existing) return { id: existing.id }

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({ student_id: studentId, teacher_id: teacherId })
    .select('id')
    .single()

  if (!insertError) return { id: created.id }

  // Unique-violation from a concurrent create in another tab -- the row
  // now exists, so just re-fetch it instead of surfacing the race as an error.
  if (insertError.code === '23505') {
    const { data: retried, error: retryError } = await supabase
      .from('conversations')
      .select('id')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .single()
    if (retryError) return { error: retryError.message }
    return { id: retried.id }
  }

  return { error: insertError.message }
}
