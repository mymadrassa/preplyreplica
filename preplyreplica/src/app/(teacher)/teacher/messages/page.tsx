import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/Avatar'
import { ShieldCheck } from 'lucide-react'
import { ADMIN_SENDER_NAME, unreadFromAdmin } from '@/lib/support'
import { loadParticipants } from '@/lib/participantNames'

export default async function TeacherMessagesPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id

  if (!userId) {
    return (
      <main className="container mx-auto px-4 py-12">
        <p className="text-slate-700">You must be logged in to view this page.</p>
      </main>
    )
  }

  const [{ data: conversations }, adminUnread] = await Promise.all([
    supabase.from('conversations').select('id, created_at, student_id').eq('teacher_id', userId).order('created_at', { ascending: false }),
    unreadFromAdmin(userId),
  ])
  const people = await loadParticipants((conversations ?? []).map((c) => c.student_id))

  return (
    <main className="container mx-auto px-4 py-12">
      <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Messages</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your conversations</h1>

      <div className="mt-8 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-card">
        {/* The team's conversation is always first. */}
        <Link href="/teacher/messages/admin" className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-slate-50">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-medium text-slate-900">{ADMIN_SENDER_NAME}</span>
            <span className="block text-xs text-slate-500">Messages from our team about your profile</span>
          </span>
          {adminUnread ? (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">{adminUnread} new</span>
          ) : null}
        </Link>
        {conversations?.length ? (
          conversations.map((conversation) => {
            const student = people.get(conversation.student_id)
            const studentName = student?.name ?? 'User'
            return (
              <Link
                key={conversation.id}
                href={`/teacher/messages/${conversation.id}`}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-slate-50"
              >
                <Avatar name={studentName} avatarUrl={student?.avatarUrl} />
                <span className="font-medium text-slate-900">{studentName}</span>
              </Link>
            )
          })
        ) : (
          <p className="p-8 text-center text-slate-600">No conversations with students yet.</p>
        )}
      </div>
    </main>
  )
}
