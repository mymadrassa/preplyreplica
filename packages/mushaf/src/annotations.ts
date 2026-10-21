import type { MushafClient } from './session'
import type { MushafAnnotation, MushafTables } from './types'

type AnnotationRow = MushafTables['mushaf_annotations']['Row']

export function annotationFromRow(row: AnnotationRow): MushafAnnotation {
  return {
    id: row.id,
    sessionId: row.session_id,
    authorId: row.author_id,
    bookingId: row.booking_id,
    kind: row.kind,
    color: row.color,
    errorType: row.error_type,
    wordRef: row.word_ref,
    endWordRef: row.end_word_ref,
    verseRef: row.verse_ref,
    noteText: row.note_text,
    createdAt: row.created_at,
  }
}

/** Mirrors the `mushaf_annotations_delete` RLS policy so the UI can hide the control; the policy is what actually enforces it. */
export function canDeleteAnnotation(annotation: Pick<MushafAnnotation, 'authorId'>, userId: string, isAdmin = false): boolean {
  return isAdmin || annotation.authorId === userId
}

export type NewAnnotation = Omit<MushafAnnotation, 'id' | 'sessionId' | 'authorId' | 'bookingId' | 'createdAt'>

export async function listAnnotations(supabase: MushafClient, sessionId: string): Promise<MushafAnnotation[]> {
  const { data } = await supabase
    .from('mushaf_annotations')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  return ((data ?? []) as AnnotationRow[]).map(annotationFromRow)
}

export async function addAnnotation(
  supabase: MushafClient,
  sessionId: string,
  authorId: string,
  annotation: NewAnnotation,
  bookingId: string | null = null
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mushaf_annotations').insert({
    session_id: sessionId,
    author_id: authorId,
    booking_id: bookingId,
    kind: annotation.kind,
    color: annotation.color,
    error_type: annotation.errorType,
    word_ref: annotation.wordRef,
    end_word_ref: annotation.endWordRef,
    verse_ref: annotation.verseRef,
    note_text: annotation.noteText,
  })
  return { error: error?.message ?? null }
}

/** Inserts several marks in one round trip (e.g. one highlight per selected word). */
export async function addAnnotations(
  supabase: MushafClient,
  sessionId: string,
  authorId: string,
  annotations: NewAnnotation[],
  bookingId: string | null = null
): Promise<{ error: string | null }> {
  if (!annotations.length) return { error: null }
  const { error } = await supabase.from('mushaf_annotations').insert(
    annotations.map((annotation) => ({
      session_id: sessionId,
      author_id: authorId,
      booking_id: bookingId,
      kind: annotation.kind,
      color: annotation.color,
      error_type: annotation.errorType,
      word_ref: annotation.wordRef,
      end_word_ref: annotation.endWordRef,
      verse_ref: annotation.verseRef,
      note_text: annotation.noteText,
    }))
  )
  return { error: error?.message ?? null }
}

export async function deleteAnnotations(supabase: MushafClient, annotationIds: string[]): Promise<{ error: string | null }> {
  if (!annotationIds.length) return { error: null }
  const { error } = await supabase.from('mushaf_annotations').delete().in('id', annotationIds)
  return { error: error?.message ?? null }
}

export async function deleteAnnotation(supabase: MushafClient, annotationId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mushaf_annotations').delete().eq('id', annotationId)
  return { error: error?.message ?? null }
}
