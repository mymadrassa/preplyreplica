import { z } from 'zod'

// Post-lesson feedback, shared by the popup, the API and the pages that show it.

export type FeedbackRole = 'student' | 'teacher'

export const TEACHER_TAGS = {
  encouraging: [
    { key: 'well_prepared', label: 'Well prepared' },
    { key: 'great_effort', label: 'Great effort' },
    { key: 'fluent_recitation', label: 'Fluent recitation' },
    { key: 'solid_memorisation', label: 'Solid memorisation' },
    { key: 'good_tajwid', label: 'Good tajwid' },
  ],
  toWorkOn: [
    { key: 'needs_revision', label: 'Needs more revision' },
    { key: 'work_on_tajwid', label: 'Work on tajwid' },
    { key: 'hesitant', label: 'Hesitant' },
    { key: 'arrived_late', label: 'Arrived late' },
    { key: 'distracted', label: 'Distracted' },
  ],
} as const

const TAG_LABELS = new Map<string, { label: string; encouraging: boolean }>([
  ...TEACHER_TAGS.encouraging.map((t) => [t.key, { label: t.label, encouraging: true }] as const),
  ...TEACHER_TAGS.toWorkOn.map((t) => [t.key, { label: t.label, encouraging: false }] as const),
])

/** Label and tone of a stored tag key; unknown keys are dropped. */
export function describeTags(keys: string[]): { key: string; label: string; encouraging: boolean }[] {
  return keys.flatMap((key) => {
    const tag = TAG_LABELS.get(key)
    return tag ? [{ key, ...tag }] : []
  })
}

const skipSchema = z.object({ skip: z.literal(true) })
const studentSchema = z.object({
  skip: z.literal(false).optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().nullable(),
  visibility: z.enum(['public', 'private']),
})
const teacherSchema = z.object({
  skip: z.literal(false).optional(),
  tags: z
    .array(z.string())
    .min(1, 'Pick at least one tag.')
    .refine((tags) => tags.every((tag) => TAG_LABELS.has(tag)), 'Unknown tag.')
    .transform((tags) => [...new Set(tags)]),
})

/** What each side may send: their feedback, or a skip. */
export function feedbackSchema(role: FeedbackRole) {
  return role === 'student' ? z.union([skipSchema, studentSchema]) : z.union([skipSchema, teacherSchema])
}

export const FEEDBACK_WINDOW_DAYS = 14

/**
 * Whether to ask for feedback on a lesson: it has ended (or, right after
 * hanging up, `force` and it has started), it went ahead, and it isn't older
 * than the window, so old lessons never nag.
 */
export function isFeedbackDue(
  booking: { start_at: string; end_at: string; status: string },
  now: Date = new Date(),
  { force = false }: { force?: boolean } = {}
): boolean {
  if (booking.status !== 'confirmed' && booking.status !== 'completed') return false
  const started = new Date(booking.start_at) <= now
  const ended = new Date(booking.end_at) <= now
  if (!(ended || (force && started))) return false
  return now.getTime() - new Date(booking.end_at).getTime() <= FEEDBACK_WINDOW_DAYS * 86_400_000
}

/** The popup's content, as the layouts and the GET route hand it over. */
export interface FeedbackPromptData {
  bookingId: string
  role: FeedbackRole
  otherName: string
  subject: string
  startAt: string
}
