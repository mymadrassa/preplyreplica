import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { hasPendingChanges, loadTeacherProfileState, pendingDocumentChanges, removeAvatarFile } from '@/lib/teacherProfileState'

const schema = z.object({ action: z.enum(['submit', 'discard']) })

/**
 * A live teacher's pending copy: submit it for admin review (it then locks
 * until decided), or discard it and keep the live profile as it is.
 */
export async function POST(request: Request) {
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

  const state = await loadTeacherProfileState(supabase, userId)
  if (!state?.changes || !state.pending) {
    return NextResponse.json({ error: 'You have no pending changes.' }, { status: 409 })
  }
  if (state.changes.state === 'submitted') {
    return NextResponse.json({ error: 'Your changes are already with our team.' }, { status: 409 })
  }

  if (parsed.data.action === 'discard') {
    const { error } = await supabase.from('teacher_profile_changes').delete().eq('teacher_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await removeAvatarFile(supabase, state.pending.avatar_url, [state.live.avatar_url])

    // Undo ID changes too: new uploads go, IDs marked for removal stay.
    const docs = pendingDocumentChanges(state.documents)
    if (docs.added.length) {
      await supabase.from('teacher_documents').delete().in('id', docs.added.map((d) => d.id)).eq('teacher_id', userId)
      await supabase.storage.from('teacher-documents').remove(docs.added.map((d) => d.bucket_path))
    }
    if (docs.removed.length) {
      await supabase.from('teacher_documents').update({ review_change: null }).in('id', docs.removed.map((d) => d.id)).eq('teacher_id', userId)
    }
    return NextResponse.json({ discarded: true })
  }

  if (!hasPendingChanges(state)) {
    return NextResponse.json({ error: 'Nothing has changed from your live profile.' }, { status: 409 })
  }

  const { error } = await supabase
    .from('teacher_profile_changes')
    .update({ state: 'submitted', submitted_at: new Date().toISOString(), review_note: null, updated_at: new Date().toISOString() })
    .eq('teacher_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submitted: true })
}
