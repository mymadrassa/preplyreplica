import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { TEACHER_CATALOGUE_TAG } from '@/lib/teacherCatalogue'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { feedbackSchema, type FeedbackRole } from '@/lib/sessionFeedback'
import { loadFeedbackPrompt } from '@/lib/loadFeedbackDue'

/** The popup's content for this lesson, if the caller still owes feedback on it (used right after hanging up). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ prompt: await loadFeedbackPrompt(supabase, userId, params.id) })
}

/**
 * Saves the caller's feedback on a lesson that went well (ratings per
 * criterion), or records a skip so the popup stops; problems go through
 * ../report instead. A student's public feedback also becomes a review on the teacher's
 * profile (which updates their rating).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: booking } = await supabase.from('bookings').select('id, student_id, teacher_id, start_at, status').eq('id', params.id).maybeSingle()
  const role: FeedbackRole | null = booking?.student_id === userId ? 'student' : booking?.teacher_id === userId ? 'teacher' : null
  if (!booking || !role) {
    return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 })
  }
  if ((booking.status !== 'confirmed' && booking.status !== 'completed') || new Date(booking.start_at) > new Date()) {
    return NextResponse.json({ error: 'Feedback opens once the lesson has started.' }, { status: 409 })
  }

  const parsed = feedbackSchema(role).safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid feedback.' }, { status: 400 })
  }

  const service = createSupabaseServiceRoleClient()
  const { data: existing } = await service.from('session_feedback').select('status').eq('booking_id', booking.id).eq('author_id', userId).maybeSingle()
  // A skip can still be turned into feedback later; given feedback is final.
  if (existing?.status === 'given') {
    return NextResponse.json({ error: 'You already gave feedback on this lesson.' }, { status: 409 })
  }

  const feedback = parsed.data
  const base = {
    booking_id: booking.id,
    author_id: userId,
    recipient_id: role === 'student' ? booking.teacher_id : booking.student_id,
    author_role: role,
  }
  const row: Database['public']['Tables']['session_feedback']['Insert'] =
    'rating' in feedback
      ? { ...base, status: 'given' as const, rating: feedback.rating, comment: feedback.comment || null, visibility: feedback.visibility, tags: [], criteria: feedback.criteria }
      : 'tags' in feedback
        ? { ...base, status: 'given' as const, rating: null, comment: null, visibility: null, tags: feedback.tags, criteria: feedback.criteria }
        : { ...base, status: 'skipped' as const, rating: null, comment: null, visibility: null, tags: [] }

  const { error } = await service.from('session_feedback').upsert(row, { onConflict: 'booking_id,author_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The reviews insert policy only allows admin-completed lessons, but the
  // popup comes right after the lesson; the checks above stand in for it.
  if ('rating' in feedback && feedback.visibility === 'public') {
    const { data: review } = await service.from('reviews').select('id').eq('booking_id', booking.id).maybeSingle()
    if (!review) {
      const { error: reviewError } = await service
        .from('reviews')
        .insert({ booking_id: booking.id, student_id: userId, teacher_id: booking.teacher_id, rating: feedback.rating, comment: feedback.comment || null })
      if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 })
      revalidateTag(TEACHER_CATALOGUE_TAG)
    }
  }

  return NextResponse.json({ status: row.status })
}
