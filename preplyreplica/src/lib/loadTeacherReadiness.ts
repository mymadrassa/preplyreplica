import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getTeacherReadiness, type TeacherReadiness } from '@/lib/teacherReadiness'

export type TeacherStatus = Database['public']['Tables']['teacher_profiles']['Row']['status']

export interface LoadedTeacherReadiness {
  status: TeacherStatus
  paymentsEnabled: boolean
  readiness: TeacherReadiness
}

/**
 * Loads what readiness needs for one teacher (profile fields, photo, identity
 * document count) in a single parallel round trip. Null when the teacher has
 * no profile yet.
 */
export async function loadTeacherReadiness(supabase: SupabaseClient<Database>, teacherId: string): Promise<LoadedTeacherReadiness | null> {
  const [{ data: teacher }, { data: profile }, { count }] = await Promise.all([
    supabase
      .from('teacher_profiles')
      .select('status, headline, bio, subjects, languages, hourly_rate, payments_enabled')
      .eq('id', teacherId)
      .maybeSingle(),
    supabase.from('profiles').select('avatar_url, phone, gender').eq('id', teacherId).maybeSingle(),
    supabase.from('teacher_documents').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId).eq('kind', 'identity').or('review_change.is.null,review_change.eq.remove'),
  ])

  if (!teacher) return null

  return {
    status: teacher.status,
    paymentsEnabled: teacher.payments_enabled,
    readiness: getTeacherReadiness({
      headline: teacher.headline,
      bio: teacher.bio,
      subjects: teacher.subjects,
      languages: teacher.languages,
      hourly_rate: teacher.hourly_rate,
      avatar_url: profile?.avatar_url ?? null,
      phone: profile?.phone ?? null,
      gender: profile?.gender ?? null,
      identityDocumentCount: count ?? 0,
      payments_enabled: teacher.payments_enabled,
    }),
  }
}
