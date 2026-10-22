import { NextResponse } from 'next/server'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'

/**
 * Takes a submission back so it can be edited again: a pending profile returns
 * to "not submitted" (leaving the admin queue), and submitted changes to a live
 * profile return to a draft. The teacher resubmits when ready.
 */
export async function POST() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: teacher }, { data: changes }] = await Promise.all([
    supabase.from('teacher_profiles').select('status').eq('id', userId).maybeSingle(),
    supabase.from('teacher_profile_changes').select('state').eq('teacher_id', userId).maybeSingle(),
  ])
  if (!teacher) {
    return NextResponse.json({ error: 'No teacher profile found.' }, { status: 404 })
  }

  if (teacher.status === 'pending') {
    const { error } = await supabase.from('teacher_profiles').update({ status: 'draft' }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ withdrawn: 'profile' })
  }

  if (changes?.state === 'submitted') {
    // A submitted copy is frozen for the teacher by RLS, so the server key re-opens it.
    const { error } = await createSupabaseServiceRoleClient()
      .from('teacher_profile_changes')
      .update({ state: 'draft', submitted_at: null, updated_at: new Date().toISOString() })
      .eq('teacher_id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ withdrawn: 'changes' })
  }

  return NextResponse.json({ error: 'There is nothing under review to withdraw.' }, { status: 409 })
}
