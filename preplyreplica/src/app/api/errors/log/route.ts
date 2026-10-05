import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  context: z.string().min(1).max(100),
  message: z.string().min(1).max(2000),
  detail: z.string().max(4000).optional(),
})

// Lets client components (which can't hold a service-role key) record a raw
// provider error for later review, without exposing write access to anyone
// else -- error_logs has no RLS policy beyond enabling it, so only this
// service-role insert can write. Best-effort: logging failures are swallowed
// rather than surfaced, since failing to log shouldn't fail the user's
// original action.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parseResult = bodySchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }

  const supabase = createSupabaseServiceRoleClient()
  await supabase.from('error_logs').insert(parseResult.data)

  return NextResponse.json({ ok: true })
}
