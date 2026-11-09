import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export interface Participant {
  /** First name and last name, as the person entered them. */
  name: string
  avatarUrl: string | null
}

/**
 * Names and photos of the people someone talks to. Profiles are only readable
 * by their owner (RLS), so a student couldn't read their teacher's name and
 * saw "Teacher" instead; the server reads them with its key. Callers pass
 * only ids from conversations the viewer is part of (already limited by RLS).
 */
export async function loadParticipants(ids: string[]): Promise<Map<string, Participant>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map()
  const { data } = await createSupabaseServiceRoleClient().from('profiles').select('id, full_name, email, avatar_url').in('id', unique)
  return new Map(
    (data ?? []).map((p) => [
      p.id,
      // Accounts created before names were asked at signup fall back to their email's first part.
      { name: p.full_name?.trim() || p.email?.split('@')[0] || 'User', avatarUrl: p.avatar_url ?? null },
    ])
  )
}
