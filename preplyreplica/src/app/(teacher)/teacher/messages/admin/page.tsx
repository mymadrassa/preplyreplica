import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { ChatThread } from '@/components/chat/ChatThread'
import { ADMIN_SENDER_NAME, getOrCreateSupportThread, markSupportThreadRead } from '@/lib/support'

/** The teacher's conversation with the platform's team: review decisions arrive here, and the teacher can reply. */
export default async function TeacherAdminMessagesPage() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/login')

  const thread = await getOrCreateSupportThread(userId)
  if (thread) await markSupportThreadRead(thread.id, 'user')

  return (
    <main className="container mx-auto max-w-2xl px-4 py-12">
      <Link href="/teacher/messages" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to messages
      </Link>
      {thread ? (
        <ChatThread target={{ kind: 'support', id: thread.id, threadUserId: userId, viewer: 'user' }} currentUserId={userId} otherPartyName={ADMIN_SENDER_NAME} />
      ) : (
        <p className="text-slate-600">This conversation can’t be opened right now. Please try again in a moment.</p>
      )}
    </main>
  )
}
