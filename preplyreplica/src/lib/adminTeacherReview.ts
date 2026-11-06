import type { Database } from '@/types/database'
import { diffProfileChanges } from '@/lib/profileEditing'
import { reviewedValuesOf } from '@/lib/teacherProfileState'

type Tables = Database['public']['Tables']

export interface ChangeField {
  field: string
  label: string
  before: unknown
  after: unknown
}

/**
 * A live teacher's submitted edits as before/after fields for the admin, or
 * null when nothing is waiting. ID documents changed after approval are
 * reviewed with the rest.
 */
export function submittedChangeFields(
  teacher: Pick<Tables['teacher_profiles']['Row'], 'headline' | 'bio' | 'subjects' | 'languages' | 'video_url'>,
  avatarUrl: string | null,
  changes: Tables['teacher_profile_changes']['Row'] | null | undefined,
  documents: Pick<Tables['teacher_documents']['Row'], 'bucket_path' | 'review_change'>[]
): ChangeField[] | null {
  if (!changes || changes.state !== 'submitted') return null
  const fields: ChangeField[] = diffProfileChanges(reviewedValuesOf(teacher, avatarUrl), {
    headline: changes.headline,
    bio: changes.bio,
    subjects: changes.subjects,
    languages: changes.languages,
    video_url: changes.video_url,
    avatar_url: changes.avatar_url,
  })
  const fileName = (path: string) => path.split('/').pop()?.replace(/^\d+-/, '') ?? path
  const removed = documents.filter((d) => d.review_change === 'remove').map((d) => fileName(d.bucket_path))
  const added = documents.filter((d) => d.review_change === 'add').map((d) => fileName(d.bucket_path))
  if (removed.length || added.length) {
    fields.push({ field: 'identity', label: 'ID document (open it in the documents list)', before: removed, after: added })
  }
  return fields
}
