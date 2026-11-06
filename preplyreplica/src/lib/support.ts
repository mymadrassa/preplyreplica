import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

// The "Admin" conversation each user has with the platform's team, shown in
// their Messages (see migration 0039). Created on first use with the server
// key; users can't create or edit threads themselves.

export const ADMIN_SENDER_NAME = 'Admin'

/** The user's thread with the team, created if it doesn't exist yet. */
export async function getOrCreateSupportThread(userId: string): Promise<{ id: string; user_last_read_at: string | null; admin_last_read_at: string | null } | null> {
  const db = createSupabaseServiceRoleClient()
  const { data: existing } = await db.from('support_threads').select('id, user_last_read_at, admin_last_read_at').eq('user_id', userId).maybeSingle()
  if (existing) return existing
  const { data: created, error } = await db.from('support_threads').insert({ user_id: userId }).select('id, user_last_read_at, admin_last_read_at').single()
  if (created) return created
  // Created concurrently by another request: read it back.
  if (error?.code === '23505') {
    const { data } = await db.from('support_threads').select('id, user_last_read_at, admin_last_read_at').eq('user_id', userId).maybeSingle()
    return data
  }
  return null
}

/** Posts a message from an admin into a user's thread (e.g. why their profile wasn't approved). */
export async function sendAdminMessage(userId: string, adminId: string, body: string): Promise<boolean> {
  const thread = await getOrCreateSupportThread(userId)
  if (!thread) return false
  const { error } = await createSupabaseServiceRoleClient()
    .from('messages')
    .insert({ support_thread_id: thread.id, sender_id: adminId, body: body.slice(0, 4000) })
  return !error
}

/** Marks the thread read for one side, so its unread notification clears. */
export async function markSupportThreadRead(threadId: string, side: 'user' | 'admin') {
  await createSupabaseServiceRoleClient()
    .from('support_threads')
    .update(side === 'user' ? { user_last_read_at: new Date().toISOString() } : { admin_last_read_at: new Date().toISOString() })
    .eq('id', threadId)
}

/** Messages from the team the user hasn't read yet (0 when there's no thread). */
export async function unreadFromAdmin(userId: string): Promise<number> {
  const db = createSupabaseServiceRoleClient()
  const { data: thread } = await db.from('support_threads').select('id, user_last_read_at').eq('user_id', userId).maybeSingle()
  if (!thread) return 0
  let query = db.from('messages').select('id', { count: 'exact', head: true }).eq('support_thread_id', thread.id).neq('sender_id', userId)
  if (thread.user_last_read_at) query = query.gt('created_at', thread.user_last_read_at)
  const { count } = await query
  return count ?? 0
}

/** Users whose latest replies the admins haven't read yet, by user id. */
export async function usersWithUnreadReplies(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set()
  const db = createSupabaseServiceRoleClient()
  const { data: threads } = await db.from('support_threads').select('id, user_id, admin_last_read_at').in('user_id', userIds)
  const unread = new Set<string>()
  await Promise.all(
    (threads ?? []).map(async (thread) => {
      let query = db.from('messages').select('id', { count: 'exact', head: true }).eq('support_thread_id', thread.id).eq('sender_id', thread.user_id)
      if (thread.admin_last_read_at) query = query.gt('created_at', thread.admin_last_read_at)
      const { count } = await query
      if (count) unread.add(thread.user_id)
    })
  )
  return unread
}
