import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { TEACHER_CATALOGUE_TAG } from '@/lib/teacherCatalogue'
import { loadTeacherProfileState, removeAvatarFile, saveToPendingCopy } from '@/lib/teacherProfileState'

const photoSchema = z.object({ path: z.string().min(3).max(500) })

/**
 * Saves a profile photo the teacher has just uploaded to `avatars/{userId}/…`.
 * Not live yet: it replaces the current photo (and deletes the old file).
 * Live profile: it goes into the pending copy for review, and the live photo
 * stays until the admin approves. Under review: refused.
 */
export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = photoSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }
  const { path } = parsed.data
  if (!path.startsWith(`${userId}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'That file is not in your own folder.' }, { status: 400 })
  }

  const state = await loadTeacherProfileState(supabase, userId)
  if (!state) {
    return NextResponse.json({ error: 'Finish your teacher profile first.' }, { status: 409 })
  }

  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl

  if (state.mode === 'locked') {
    await supabase.storage.from('avatars').remove([path])
    return NextResponse.json({ error: 'Your profile is under review, so the photo can’t be changed until our team has decided.' }, { status: 409 })
  }

  if (state.mode === 'review-edit') {
    const previousPending = state.pending?.avatar_url ?? null
    const { error } = await saveToPendingCopy(supabase, state, { avatar_url: url })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Only an earlier *pending* photo is thrown away; the live one stays until approval.
    await removeAvatarFile(supabase, previousPending, [state.live.avatar_url, url])
    return NextResponse.json({ avatarUrl: url, pendingReview: true })
  }

  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await removeAvatarFile(supabase, state.avatarUrl, [state.pending?.avatar_url ?? null, url])
  revalidateTag(TEACHER_CATALOGUE_TAG)
  return NextResponse.json({ avatarUrl: url, pendingReview: false })
}
