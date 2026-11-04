import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { TEACHER_CATALOGUE_TAG } from '@/lib/teacherCatalogue'

// 'auto' hands the tier back to the daily promotion job.
const schema = z.object({ tier: z.enum(['starter', 'mid', 'top', 'auto']) })

/** An admin sets a teacher's tier by hand (kept until set back to automatic). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose starter, mid, top or auto.' }, { status: 400 })
  }

  const { tier } = parsed.data
  const { error } = await supabase
    .from('teacher_profiles')
    .update(tier === 'auto' ? { tier_locked: false } : { tier, tier_locked: true, tier_updated_at: new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag(TEACHER_CATALOGUE_TAG)
  return NextResponse.json({ ok: true })
}
