import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { ChatThread } from '@/components/chat/ChatThread'

export default async function StudentConversationPage({ params }: { params: { conversationId: string } }) {
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

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, student_id, teacher_profiles(id, profiles(full_name))')
    .eq('id', params.conversationId)
    .single()

  if (!conversation || conversation.student_id !== userId) {
    return notFound()
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-12">
      <Link href="/student/messages" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to messages
      </Link>
      <ChatThread conversationId={conversation.id} currentUserId={userId} otherPartyName={conversation.teacher_profiles?.profiles?.full_name ?? 'Teacher'} />
    </main>
  )
}
