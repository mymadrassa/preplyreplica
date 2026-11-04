import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const schema = z.object({ authorId: z.string().uuid().optional() })

/** The caller saw the feedback left for them (optionally only one author's), so it leaves their bell. */
export async function POST(request: Request) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  // Feedback rows are written only by the server; this sets one field on the caller's received rows.
  let query = createSupabaseServiceRoleClient()
    .from('session_feedback')
    .update({ recipient_seen_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .eq('status', 'given')
    .is('recipient_seen_at', null)
  if (parsed.data.authorId) query = query.eq('author_id', parsed.data.authorId)
  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
