import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/Avatar'

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

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, created_at, profiles!student_id(full_name, avatar_url)')
    .eq('teacher_id', userId)
    .order('created_at', { ascending: false })

  return (
    <main className="container mx-auto px-4 py-12">
      <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Messages</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your conversations</h1>

      <div className="mt-8 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-card">
        {conversations?.length ? (
          conversations.map((conversation) => {
            const studentName = conversation.profiles?.full_name ?? 'Student'
            return (
              <Link
                key={conversation.id}
                href={`/teacher/messages/${conversation.id}`}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-slate-50"
              >
                <Avatar name={studentName} avatarUrl={conversation.profiles?.avatar_url} />
                <span className="font-medium text-slate-900">{studentName}</span>
              </Link>
            )
          })
        ) : (
          <p className="p-8 text-center text-slate-600">No conversations yet.</p>
        )}
      </div>
    </main>
  )
}
