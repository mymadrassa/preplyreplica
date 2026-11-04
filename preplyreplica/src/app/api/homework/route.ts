import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { rangeToRow, validateRange } from '@/lib/homework'
import { getSurahs } from '@/lib/surahs'
import { notifyHomework } from '@/lib/notifyHomework'

const rangeSchema = z
  .object({ fromSurah: z.number().int(), fromAyah: z.number().int(), toSurah: z.number().int(), toAyah: z.number().int() })
  .nullable()

const schema = z.object({
  bookingId: z.string().uuid(),
  revision: rangeSchema,
  memorization: rangeSchema,
  note: z.string().max(500).nullable(),
  /** Send the saved entry again without changing it. */
  resendOnly: z.boolean().optional(),
})

/**
 * The teacher saves the cahier de texte for one of their lessons and it's
 * sent to the student (WhatsApp, email fallback). Saving again updates the
 * entry and re-sends it as "updated".
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
  const { bookingId, revision, memorization, resendOnly } = parsed.data
  const note = parsed.data.note?.trim() || null

  const [{ data: booking }, { data: existing }, surahs] = await Promise.all([
    supabase.from('bookings').select('id, teacher_id, student_id, status').eq('id', bookingId).maybeSingle(),
    supabase.from('lesson_homework').select('*').eq('booking_id', bookingId).maybeSingle(),
    getSurahs(),
  ])
  if (!booking || booking.teacher_id !== userId) {
    return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 })
  }
  if (booking.status !== 'confirmed' && booking.status !== 'completed') {
    return NextResponse.json({ error: 'Homework can only be set for a confirmed or completed lesson.' }, { status: 409 })
  }

  if (resendOnly) {
    if (!existing) return NextResponse.json({ error: 'Nothing to resend yet.' }, { status: 409 })
    const sent = await notifyHomework(existing.id, { updated: true })
    return NextResponse.json({ id: existing.id, ...sent })
  }

  if (!revision && !memorization && !note) {
    return NextResponse.json({ error: 'Add a revision, a new memorisation or a note.' }, { status: 400 })
  }
  for (const [label, range] of [['Revision', revision], ['New memorisation', memorization]] as const) {
    const problem = range ? validateRange(range, surahs) : null
    if (problem) return NextResponse.json({ error: `${label}: ${problem}` }, { status: 400 })
  }

  const content = { ...rangeToRow(revision, 'revision'), ...rangeToRow(memorization, 'memorization'), note }
  const changed = !existing || Object.entries(content).some(([key, value]) => (existing as Record<string, unknown>)[key] !== value)
  const { data: saved, error } = await supabase
    .from('lesson_homework')
    .upsert(
      {
        booking_id: bookingId,
        teacher_id: userId,
        student_id: booking.student_id,
        ...content,
        // A new or changed entry counts as unread for the student again,
        // and as a fresh to-do if they had already ticked it.
        student_seen_at: null,
        ...(changed ? { done_at: null, teacher_seen_done_at: null } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id' }
    )
    .select('id')
    .single()
  if (error || !saved) {
    return NextResponse.json({ error: error?.message || 'Unable to save the homework.' }, { status: 500 })
  }

  const sent = await notifyHomework(saved.id, { updated: !!existing })
  return NextResponse.json({ id: saved.id, ...sent })
}
