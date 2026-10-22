import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { TEACHER_CATALOGUE_TAG } from '@/lib/teacherCatalogue'
import { loadTeacherProfileState, pendingDocumentChanges, removeAvatarFile } from '@/lib/teacherProfileState'

const schema = z.object({
  teacherId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  note: z.string().max(1000).optional(),
})

/**
 * Admin decision on a live teacher's submitted changes. Approving copies them
 * onto the live profile and deletes the copy, so only the newest version is
 * kept. Rejecting hands the copy back to the teacher as a draft, with a note.
 */
export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }
  const { teacherId, action, note } = parsed.data

  const state = await loadTeacherProfileState(supabase, teacherId)
  if (!state?.changes || !state.pending || state.changes.state !== 'submitted') {
    return NextResponse.json({ error: 'This teacher has no changes waiting for review.' }, { status: 409 })
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('teacher_profile_changes')
      .update({ state: 'draft', review_note: note?.trim() || null, updated_at: new Date().toISOString() })
      .eq('teacher_id', teacherId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rejected: true })
  }

  const { pending, live } = state
  const { error: profileError } = await supabase
    .from('teacher_profiles')
    .update({
      headline: pending.headline,
      bio: pending.bio,
      subjects: pending.subjects,
      languages: pending.languages,
      video_url: pending.video_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', teacherId)
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  if (pending.avatar_url !== live.avatar_url) {
    const { error: avatarError } = await supabase.from('profiles').update({ avatar_url: pending.avatar_url }).eq('id', teacherId)
    if (avatarError) return NextResponse.json({ error: avatarError.message }, { status: 500 })
  }

  const { error: deleteError } = await supabase.from('teacher_profile_changes').delete().eq('teacher_id', teacherId)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  // Apply ID changes: new IDs become live, IDs marked for removal are deleted
  // (the files sit in the teacher's own folder, so the server key removes them).
  const docs = pendingDocumentChanges(state.documents)
  if (docs.added.length) {
    await supabase.from('teacher_documents').update({ review_change: null }).in('id', docs.added.map((d) => d.id))
  }
  if (docs.removed.length) {
    await supabase.from('teacher_documents').delete().in('id', docs.removed.map((d) => d.id))
    await createSupabaseServiceRoleClient().storage.from('teacher-documents').remove(docs.removed.map((d) => d.bucket_path))
  }

  // The replaced live photo is no longer used by any version. The file sits in the
  // teacher's own folder, which only they may write, so the server key removes it.
  if (pending.avatar_url !== live.avatar_url) {
    await removeAvatarFile(createSupabaseServiceRoleClient(), live.avatar_url, [pending.avatar_url])
  }

  revalidateTag(TEACHER_CATALOGUE_TAG)
  return NextResponse.json({ approved: true })
}
