import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const eventSchema = z.object({
  teacherId: z.string().uuid(),
  eventType: z.enum(['impression', 'selection']),
  score: z.number().optional(),
  rank: z.number().int().optional(),
})

const MAX_EVENTS_PER_REQUEST = 50
const bodySchema = z.object({ events: z.array(eventSchema).min(1).max(MAX_EVENTS_PER_REQUEST) })

// Logged during the guest-mode teacher-browse step of the onboarding wizard,
// before an account exists -- there's no auth.uid() yet, so this goes
// through the service-role client rather than the browser client (which the
// recommendation_events RLS policy wouldn't let write as an anonymous user
// anyway, beyond the explicit `student_id is null` allowance).
export async function POST(request: Request) {
  const body = await request.json()
  const parseResult = bodySchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.message }, { status: 400 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.from('recommendation_events').insert(
    parseResult.data.events.map((event) => ({
      teacher_id: event.teacherId,
      event_type: event.eventType,
      score: event.score ?? null,
      rank: event.rank ?? null,
      student_id: null,
    }))
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
