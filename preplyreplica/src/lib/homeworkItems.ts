import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { formatRange, rangeFromRow, type AyahRange } from '@/lib/homework'
import { getSurahs, getVersePage } from '@/lib/surahs'

export interface HomeworkRangeView {
  /** e.g. "Al-Baqarah 1–20" */
  label: string
  /** Mushaf page of its first ayah, for jump links; null if the lookup failed. */
  page: number | null
}

/** One lesson's homework, ready to render (serializable, so it can go to client components). */
export interface HomeworkItem {
  id: string
  bookingId: string
  teacherId: string
  teacherName: string
  studentId: string
  lessonAt: string
  revision: HomeworkRangeView | null
  memorization: HomeworkRangeView | null
  note: string | null
  doneAt: string | null
  /** Not opened by the student yet. */
  unseen: boolean
  /** The teacher's quick tags about that lesson (see FeedbackTags). */
  feedbackTags: string[]
}

/**
 * Homework for a student, a teacher, or one pair, newest lesson first, with
 * ranges formatted and their Mushaf pages resolved. RLS limits it to entries
 * the caller may read.
 */
export async function loadHomeworkItems(
  supabase: SupabaseClient<Database>,
  filter: { studentId?: string; teacherId?: string },
  limit = 50
): Promise<HomeworkItem[]> {
  let query = supabase
    .from('lesson_homework')
    .select('*, bookings(start_at), teacher_profiles(profiles(full_name))')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (filter.studentId) query = query.eq('student_id', filter.studentId)
  if (filter.teacherId) query = query.eq('teacher_id', filter.teacherId)

  const [{ data }, surahs] = await Promise.all([query, getSurahs()])
  const rows = data ?? []
  const { data: feedback } = rows.length
    ? await supabase
        .from('session_feedback')
        .select('booking_id, tags')
        .eq('author_role', 'teacher')
        .eq('status', 'given')
        .in('booking_id', rows.map((row) => row.booking_id))
    : { data: [] }
  const tagsByBooking = new Map((feedback ?? []).map((f) => [f.booking_id, f.tags]))

  const view = async (range: AyahRange | null): Promise<HomeworkRangeView | null> =>
    range ? { label: formatRange(range, surahs), page: await getVersePage(range.fromSurah, range.fromAyah) } : null

  const items = await Promise.all(
    rows.map(async (row): Promise<HomeworkItem> => {
      const [revision, memorization] = await Promise.all([view(rangeFromRow(row, 'revision')), view(rangeFromRow(row, 'memorization'))])
      return {
        id: row.id,
        bookingId: row.booking_id,
        teacherId: row.teacher_id,
        teacherName: row.teacher_profiles?.profiles?.full_name || 'Your teacher',
        studentId: row.student_id,
        lessonAt: row.bookings?.start_at ?? row.created_at,
        revision,
        memorization,
        note: row.note,
        doneAt: row.done_at,
        unseen: !row.student_seen_at,
        feedbackTags: tagsByBooking.get(row.booking_id) ?? [],
      }
    })
  )
  return items.sort((a, b) => b.lessonAt.localeCompare(a.lessonAt))
}
