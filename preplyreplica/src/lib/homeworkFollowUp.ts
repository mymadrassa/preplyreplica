// How a student is keeping up with homework, for the teacher's follow-up pages.
// Pure, so the numbers are unit-tested and identical on the list and detail pages.

export interface FollowUpLesson {
  id: string
  start_at: string
}

export interface FollowUpHomework {
  booking_id: string
  done_at: string | null
  teacher_seen_done_at: string | null
}

export interface StudentFollowUp {
  lessons: number
  lastLessonAt: string | null
  given: number
  done: number
  open: number
  /** done / given, 0–1; null when no homework was given. */
  completionRate: number | null
  /**
   * Share of homework done before the next lesson with this teacher, 0–1,
   * counting only homework whose next lesson has passed or that is done.
   * Homework from the latest lesson has no deadline yet, so any completion is on time.
   */
  onTimeRate: number | null
  /** Finished homework the teacher hasn't looked at yet. */
  unseenDone: number
}

export function summarizeFollowUp(lessons: FollowUpLesson[], homework: FollowUpHomework[], now: Date = new Date()): StudentFollowUp {
  const ordered = [...lessons].sort((a, b) => a.start_at.localeCompare(b.start_at))
  const nextLessonAfter = new Map<string, string | null>()
  ordered.forEach((lesson, index) => nextLessonAfter.set(lesson.id, ordered[index + 1]?.start_at ?? null))

  let onTime = 0
  let judged = 0
  for (const entry of homework) {
    const deadline = nextLessonAfter.get(entry.booking_id) ?? null
    if (entry.done_at) {
      judged++
      if (!deadline || entry.done_at <= deadline) onTime++
    } else if (deadline && new Date(deadline) <= now) {
      judged++
    }
  }

  const done = homework.filter((h) => h.done_at).length
  return {
    lessons: lessons.length,
    lastLessonAt: ordered.length ? ordered[ordered.length - 1].start_at : null,
    given: homework.length,
    done,
    open: homework.length - done,
    completionRate: homework.length ? done / homework.length : null,
    onTimeRate: judged ? onTime / judged : null,
    unseenDone: homework.filter((h) => h.done_at && !h.teacher_seen_done_at).length,
  }
}

/** "75%", or "—" when there's nothing to measure yet. */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}
