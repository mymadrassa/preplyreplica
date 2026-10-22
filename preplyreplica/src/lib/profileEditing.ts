// The rules for when and how a teacher may edit their profile. The APIs and
// the Profile page both decide from these functions, so they can't disagree.

export type TeacherProfileStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'
export type ChangesState = 'draft' | 'submitted' | null

/**
 * - edit:        not yet live (draft, rejected): edits save directly.
 * - locked:      under review (first submission pending, or submitted changes): read-only.
 * - review-edit: live (approved, suspended): read mode with Edit; edits to reviewed fields
 *                wait in a pending copy while the approved profile stays live.
 */
export type ProfileEditMode = 'edit' | 'locked' | 'review-edit'

export function profileEditMode(status: TeacherProfileStatus, changesState: ChangesState): ProfileEditMode {
  if (status === 'pending') return 'locked'
  if (status === 'approved' || status === 'suspended') return changesState === 'submitted' ? 'locked' : 'review-edit'
  return 'edit'
}

/** What students read about a teacher. After approval, changing any of these needs admin review. Everything else (rate, payouts, documents, availability) applies immediately. */
export const REVIEWED_FIELDS = ['headline', 'bio', 'subjects', 'languages', 'video_url', 'avatar_url'] as const
export type ReviewedField = (typeof REVIEWED_FIELDS)[number]

export type ReviewedValues = {
  headline: string | null
  bio: string | null
  subjects: string[]
  languages: string[]
  video_url: string | null
  avatar_url: string | null
}

export const REVIEWED_FIELD_LABELS: Record<ReviewedField, string> = {
  headline: 'Headline',
  bio: 'Bio',
  subjects: 'Subjects',
  languages: 'Languages',
  video_url: 'Intro video',
  avatar_url: 'Profile photo',
}

function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = Array.isArray(a) ? [...a].sort() : []
    const y = Array.isArray(b) ? [...b].sort() : []
    return x.length === y.length && x.every((v, i) => v === y[i])
  }
  return (a ?? null) === (b ?? null) || (!a && !b)
}

/** The reviewed fields whose pending value differs from the live one, with both values. */
export function diffProfileChanges(
  live: ReviewedValues,
  pending: ReviewedValues
): { field: ReviewedField; label: string; before: ReviewedValues[ReviewedField]; after: ReviewedValues[ReviewedField] }[] {
  return REVIEWED_FIELDS.filter((field) => !same(live[field], pending[field])).map((field) => ({
    field,
    label: REVIEWED_FIELD_LABELS[field],
    before: live[field],
    after: pending[field],
  }))
}
