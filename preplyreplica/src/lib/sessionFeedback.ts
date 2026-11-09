import { z } from 'zod'
import type { ReportReason } from '@/types/database'

export type { ReportReason }

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

/** What each side rates from 1 to 5 when the lesson went well. */
export const CRITERIA = {
  student: [
    { key: 'teaching', label: 'Teaching and explanations' },
    { key: 'punctuality', label: 'Punctuality' },
    { key: 'preparation', label: 'Lesson preparation' },
    { key: 'patience', label: 'Patience and encouragement' },
    { key: 'connection', label: 'Connection quality (sound and video)' },
  ],
  teacher: [
    { key: 'revision', label: 'Revision done (preparation)' },
    { key: 'punctuality', label: 'Punctuality' },
    { key: 'focus', label: 'Focus and participation' },
    { key: 'connection', label: 'Connection quality (sound and video)' },
  ],
} as const

/** A score for every criterion of that side, and nothing else. */
function criteriaSchema(role: FeedbackRole) {
  const keys: readonly string[] = CRITERIA[role].map((c) => c.key)
  return z
    .record(z.number().int().min(1).max(5))
    .refine((scores) => keys.every((key) => key in scores), 'Rate every point.')
    .transform((scores) => Object.fromEntries(keys.map((key) => [key, scores[key]])) as Record<string, number>)
}

const skipSchema = z.object({ skip: z.literal(true) })
const studentSchema = z.object({
  skip: z.literal(false).optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().nullable(),
  visibility: z.enum(['public', 'private']),
  criteria: criteriaSchema('student'),
})
const teacherSchema = z.object({
  skip: z.literal(false).optional(),
  criteria: criteriaSchema('teacher'),
  tags: z
    .array(z.string())
    .refine((tags) => tags.every((tag) => TAG_LABELS.has(tag)), 'Unknown tag.')
    .transform((tags) => [...new Set(tags)])
    .default([]),
})

/** What each side may send when the lesson went well: their feedback, or a skip. */
export function feedbackSchema(role: FeedbackRole) {
  return role === 'student' ? z.union([skipSchema, studentSchema]) : z.union([skipSchema, teacherSchema])
}

/** Labels and averages of stored criteria scores (unknown keys dropped). */
export function describeCriteria(role: FeedbackRole, scores: Record<string, number> | null | undefined): { key: string; label: string; score: number }[] {
  return CRITERIA[role].flatMap((c) => (typeof scores?.[c.key] === 'number' ? [{ key: c.key, label: c.label, score: scores[c.key] }] : []))
}

/** Average score per criterion over several feedbacks, for the follow-up and admin pages. */
export function averageCriteria(role: FeedbackRole, all: (Record<string, number> | null | undefined)[]): { key: string; label: string; average: number; count: number }[] {
  return CRITERIA[role].flatMap((c) => {
    const scores = all.map((s) => s?.[c.key]).filter((v): v is number => typeof v === 'number')
    return scores.length ? [{ key: c.key, label: c.label, average: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length }] : []
  })
}

// Problem reports: any of them holds the lesson's payout until an admin decides.

export const REPORT_REASONS: readonly { key: ReportReason; label: (role: FeedbackRole) => string; hint: string }[] = [
  { key: 'no_show', label: (role) => (role === 'student' ? "The teacher didn't show up" : "The student didn't show up"), hint: 'Nobody joined the lesson on the other side.' },
  { key: 'technical', label: () => 'Technical problem on the platform', hint: 'Video, sound, or the room wouldn’t open.' },
  { key: 'cut_short', label: () => 'The lesson was cut short', hint: 'It ended well before the planned time.' },
  { key: 'other', label: () => 'Something else', hint: 'The lesson didn’t go ahead normally.' },
]

export function reportReasonLabel(reason: string, role: FeedbackRole): string {
  return REPORT_REASONS.find((r) => r.key === reason)?.label(role) ?? reason
}

export const reportSchema = z.object({
  reason: z.enum(['no_show', 'technical', 'cut_short', 'other']),
  detail: z.string().trim().min(10, 'Tell us what happened (a few words at least).').max(2000),
})

/** Hours after the end during which either side can report a problem; after that the lesson is payable. */
export const REPORT_WINDOW_HOURS = 48

/** Whether a problem can still be reported: the lesson started, and it ended less than 48 hours ago. */
export function canReport(booking: { start_at: string; end_at: string; status: string }, now: Date = new Date()): boolean {
  if (booking.status !== 'confirmed' && booking.status !== 'completed') return false
  if (new Date(booking.start_at) > now) return false
  return now.getTime() <= new Date(booking.end_at).getTime() + REPORT_WINDOW_HOURS * 3_600_000
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
  endAt: string
}
