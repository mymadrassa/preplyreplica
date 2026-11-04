import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { FEEDBACK_WINDOW_DAYS, isFeedbackDue, type FeedbackPromptData, type FeedbackRole } from '@/lib/sessionFeedback'

type Db = SupabaseClient<Database>

const BOOKING_FIELDS = 'id, student_id, teacher_id, subject, start_at, end_at, status, teacher_profiles(profiles(full_name)), profiles!student_id(full_name)'

type BookingForPrompt = {
  id: string
  student_id: string
  teacher_id: string
  subject: string
  start_at: string
  end_at: string
  status: string
  teacher_profiles: { profiles: { full_name: string | null } | null } | null
  profiles: { full_name: string | null } | null
}

function toPrompt(booking: BookingForPrompt, role: FeedbackRole): FeedbackPromptData {
  return {
    bookingId: booking.id,
    role,
    otherName: (role === 'student' ? booking.teacher_profiles?.profiles?.full_name : booking.profiles?.full_name) || (role === 'student' ? 'your teacher' : 'your student'),
    subject: booking.subject,
    startAt: booking.start_at,
  }
}

/** The most recent ended lesson (within the window) this user hasn't given or skipped feedback on. */
export async function loadFeedbackDue(supabase: Db, userId: string, role: FeedbackRole): Promise<FeedbackPromptData | null> {
  const now = new Date()
  const since = new Date(now.getTime() - FEEDBACK_WINDOW_DAYS * 86_400_000).toISOString()
  const { data: bookings } = await supabase
    .from('bookings')
    .select(BOOKING_FIELDS)
    .eq(role === 'student' ? 'student_id' : 'teacher_id', userId)
    .in('status', ['confirmed', 'completed'])
    .lte('end_at', now.toISOString())
    .gte('end_at', since)
    .order('end_at', { ascending: false })
    .limit(10)
  const candidates = (bookings ?? []) as unknown as BookingForPrompt[]
  if (!candidates.length) return null

  const { data: answered } = await supabase
    .from('session_feedback')
    .select('booking_id')
    .eq('author_id', userId)
    .in('booking_id', candidates.map((b) => b.id))
  const done = new Set((answered ?? []).map((row) => row.booking_id))
  const due = candidates.find((b) => !done.has(b.id) && isFeedbackDue(b, now))
  return due ? toPrompt(due, role) : null
}

/** One lesson's prompt for this user, if they took part and haven't answered; used right after hanging up. */
export async function loadFeedbackPrompt(supabase: Db, userId: string, bookingId: string): Promise<FeedbackPromptData | null> {
  const [{ data: booking }, { data: existing }] = await Promise.all([
    supabase.from('bookings').select(BOOKING_FIELDS).eq('id', bookingId).maybeSingle(),
    supabase.from('session_feedback').select('id').eq('booking_id', bookingId).eq('author_id', userId).maybeSingle(),
  ])
  const lesson = booking as unknown as BookingForPrompt | null
  if (!lesson || existing) return null
  const role: FeedbackRole | null = lesson.student_id === userId ? 'student' : lesson.teacher_id === userId ? 'teacher' : null
  if (!role || !isFeedbackDue(lesson, new Date(), { force: true })) return null
  return toPrompt(lesson, role)
}
