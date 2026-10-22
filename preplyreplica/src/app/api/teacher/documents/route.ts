import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { loadTeacherProfileState, saveToPendingCopy, type TeacherProfileState } from '@/lib/teacherProfileState'

const documentSchema = z.object({
  bucket_path: z.string().min(3).max(500),
  kind: z.enum(['identity', 'certificate']),
  /** When set, the new file replaces this document. */
  replaces: z.string().uuid().optional(),
})

type Db = ReturnType<typeof createServerClient>

const LOCKED_ERROR = 'Your profile is under review, so documents can’t change until our team has decided.'

/**
 * On a live (approved) profile, ID documents are part of what's reviewed:
 * changes wait, the current ID keeps counting, and the admin sees the new one
 * before it does. Certificates, and profiles that aren't live yet, change directly.
 */
function changeNeedsReview(state: TeacherProfileState, kind: 'identity' | 'certificate') {
  return state.mode === 'review-edit' && kind === 'identity'
}

/** A pending ID change needs a pending copy to carry it through submit/approve, even with no other edits. */
async function ensurePendingCopy(supabase: Db, state: TeacherProfileState) {
  if (!state.changes) await saveToPendingCopy(supabase, state, {})
}

async function deleteDocument(supabase: Db, userId: string, document: { id: string; bucket_path: string }) {
  await supabase.from('teacher_documents').delete().eq('id', document.id).eq('teacher_id', userId)
  // Older documents may sit outside the teacher's folder; removing those files may be refused, which is harmless.
  await supabase.storage.from('teacher-documents').remove([document.bucket_path])
}

/** Records a document the teacher just uploaded into their own `{userId}/` folder, optionally replacing another. */
export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = documentSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }
  const { bucket_path, kind, replaces } = parsed.data
  if (!bucket_path.startsWith(`${userId}/`) || bucket_path.includes('..')) {
    return NextResponse.json({ error: 'That file is not in your own folder.' }, { status: 400 })
  }

  const state = await loadTeacherProfileState(supabase, userId)
  if (!state || state.mode === 'locked') {
    await supabase.storage.from('teacher-documents').remove([bucket_path])
    return NextResponse.json({ error: state ? LOCKED_ERROR : 'Finish your teacher profile before adding documents.' }, { status: 409 })
  }

  const reviewed = changeNeedsReview(state, kind)
  const { data, error } = await supabase
    .from('teacher_documents')
    .insert({ teacher_id: userId, bucket_path, kind, review_change: reviewed ? 'add' : null })
    .select('id, bucket_path, kind, review_change, uploaded_at')
    .single()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // The new document is saved first, so a failure never leaves the teacher with nothing.
  if (replaces) {
    const old = state.documents.find((d) => d.id === replaces)
    if (old) {
      if (reviewed && old.review_change !== 'add') {
        // A live ID stays until the replacement is approved.
        await supabase.from('teacher_documents').update({ review_change: 'remove' }).eq('id', old.id).eq('teacher_id', userId)
      } else {
        await deleteDocument(supabase, userId, old)
      }
    }
  }

  if (reviewed) await ensurePendingCopy(supabase, state)
  return NextResponse.json({ document: data, pendingReview: reviewed })
}

/** Removes a document (row and file). On a live profile, a live ID is only marked for removal until the change is approved. */
export async function DELETE(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing document id.' }, { status: 400 })
  }

  const state = await loadTeacherProfileState(supabase, userId)
  if (!state) {
    return NextResponse.json({ error: 'No teacher profile found.' }, { status: 404 })
  }
  if (state.mode === 'locked') {
    return NextResponse.json({ error: LOCKED_ERROR }, { status: 409 })
  }

  const document = state.documents.find((d) => d.id === id)
  if (!document) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
  }

  if (changeNeedsReview(state, document.kind) && document.review_change !== 'add') {
    const { error } = await supabase.from('teacher_documents').update({ review_change: 'remove' }).eq('id', id).eq('teacher_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await ensurePendingCopy(supabase, state)
    return NextResponse.json({ removed: id, pendingReview: true })
  }

  await deleteDocument(supabase, userId, document)
  return NextResponse.json({ removed: id, pendingReview: false })
}
