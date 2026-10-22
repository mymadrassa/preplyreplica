import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getTeacherReadiness, type TeacherReadiness } from '@/lib/teacherReadiness'
import { diffProfileChanges, profileEditMode, type ProfileEditMode, type ReviewedValues } from '@/lib/profileEditing'

type Db = SupabaseClient<Database>
export type TeacherRow = Database['public']['Tables']['teacher_profiles']['Row']
export type ChangesRow = Database['public']['Tables']['teacher_profile_changes']['Row']
export type DocumentRow = Pick<Database['public']['Tables']['teacher_documents']['Row'], 'id' | 'bucket_path' | 'kind' | 'review_change' | 'uploaded_at'>

export interface TeacherProfileState {
  teacher: TeacherRow
  avatarUrl: string | null
  documents: DocumentRow[]
  changes: ChangesRow | null
  mode: ProfileEditMode
  readiness: TeacherReadiness
  /** The reviewed fields as students see them now. */
  live: ReviewedValues
  /** The edited copy waiting for review, if any. */
  pending: ReviewedValues | null
}

export function reviewedValuesOf(teacher: Pick<TeacherRow, 'headline' | 'bio' | 'subjects' | 'languages' | 'video_url'>, avatarUrl: string | null): ReviewedValues {
  return {
    headline: teacher.headline,
    bio: teacher.bio,
    subjects: teacher.subjects ?? [],
    languages: teacher.languages ?? [],
    video_url: teacher.video_url,
    avatar_url: avatarUrl,
  }
}

/** Everything the Profile page and the profile APIs need about one teacher, in a single parallel round trip. Null when there's no profile yet. */
export async function loadTeacherProfileState(supabase: Db, teacherId: string): Promise<TeacherProfileState | null> {
  const [{ data: teacher }, { data: profile }, { data: documents }, { data: changes }] = await Promise.all([
    supabase.from('teacher_profiles').select('*').eq('id', teacherId).maybeSingle(),
    supabase.from('profiles').select('avatar_url').eq('id', teacherId).maybeSingle(),
    supabase.from('teacher_documents').select('id, bucket_path, kind, review_change, uploaded_at').eq('teacher_id', teacherId).order('uploaded_at', { ascending: true }),
    supabase.from('teacher_profile_changes').select('*').eq('teacher_id', teacherId).maybeSingle(),
  ])
  if (!teacher) return null

  const avatarUrl = profile?.avatar_url ?? null
  const docs = documents ?? []
  return {
    teacher,
    avatarUrl,
    documents: docs,
    changes: changes ?? null,
    mode: profileEditMode(teacher.status, changes?.state ?? null),
    readiness: getTeacherReadiness({
      headline: teacher.headline,
      bio: teacher.bio,
      subjects: teacher.subjects,
      languages: teacher.languages,
      hourly_rate: teacher.hourly_rate,
      avatar_url: avatarUrl,
      // A new ID waiting for review doesn't count yet; one marked for removal still does until approved.
      identityDocumentCount: docs.filter((d) => d.kind === 'identity' && d.review_change !== 'add').length,
      stripe_charges_enabled: teacher.stripe_charges_enabled,
    }),
    live: reviewedValuesOf(teacher, avatarUrl),
    pending: changes
      ? {
          headline: changes.headline,
          bio: changes.bio,
          subjects: changes.subjects,
          languages: changes.languages,
          video_url: changes.video_url,
          avatar_url: changes.avatar_url,
        }
      : null,
  }
}

/**
 * Writes reviewed fields into the teacher's pending copy, starting the copy
 * from the live values the first time so it is always a complete version.
 */
export async function saveToPendingCopy(supabase: Db, state: TeacherProfileState, update: Partial<ReviewedValues>) {
  const base = state.pending ?? state.live
  return supabase
    .from('teacher_profile_changes')
    .upsert({ teacher_id: state.teacher.id, ...base, ...update, state: 'draft', updated_at: new Date().toISOString() })
}

const AVATAR_PREFIX = '/storage/v1/object/public/avatars/'

/** The storage path of a photo in our avatars bucket, or null for anything else (e.g. an external URL). */
export function avatarStoragePath(url: string | null): string | null {
  if (!url) return null
  const index = url.indexOf(AVATAR_PREFIX)
  return index === -1 ? null : decodeURIComponent(url.slice(index + AVATAR_PREFIX.length).split('?')[0])
}

/** Deletes a replaced photo's file, unless another version still points at it. */
export async function removeAvatarFile(supabase: Db, url: string | null, stillUsed: (string | null)[] = []) {
  const path = avatarStoragePath(url)
  if (!path || stillUsed.includes(url)) return
  await supabase.storage.from('avatars').remove([path])
}

/** ID-document changes waiting for review: new uploads, and live ones marked for removal. */
export function pendingDocumentChanges(documents: DocumentRow[]) {
  return {
    added: documents.filter((d) => d.review_change === 'add'),
    removed: documents.filter((d) => d.review_change === 'remove'),
  }
}

/** True when a live teacher has anything waiting for review: changed details/photo or ID documents. */
export function hasPendingChanges(state: Pick<TeacherProfileState, 'live' | 'pending' | 'documents'>): boolean {
  const docs = pendingDocumentChanges(state.documents)
  return (!!state.pending && diffProfileChanges(state.live, state.pending).length > 0) || docs.added.length > 0 || docs.removed.length > 0
}
