import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { loadTeacherReadiness } from '@/lib/loadTeacherReadiness'
import { TEACHER_CATALOGUE_TAG } from '@/lib/teacherCatalogue'

/**
 * Sends a teacher's profile to the admin queue. Only allowed once every
 * mandatory step is done (profile, photo, ID document, payouts), from a draft
 * or after a rejection so the teacher can fix things and try again.
 */
export async function POST() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loaded = await loadTeacherReadiness(supabase, userId)
  if (!loaded) {
    return NextResponse.json({ error: 'Finish your teacher profile first.' }, { status: 409 })
  }

  if (loaded.status !== 'draft' && loaded.status !== 'rejected') {
    return NextResponse.json({ error: 'Your profile has already been submitted.' }, { status: 409 })
  }

  if (!loaded.readiness.canSubmit) {
    const missing = loaded.readiness.missing.map((item) => item.title.toLowerCase()).join(', ')
    return NextResponse.json({ error: `Before submitting: ${missing}.`, missing: loaded.readiness.missing }, { status: 409 })
  }

  const { error } = await supabase.from('teacher_profiles').update({ status: 'pending', approval_seen_at: null }).eq('id', userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateTag(TEACHER_CATALOGUE_TAG)

  return NextResponse.json({ status: 'pending' })
}
