import { notFound, redirect } from 'next/navigation'
import { getOrCreateMushafSession } from '@preply-clone/mushaf'
import { createServerClient } from '@/lib/supabase/server'
import { MushafSessionView } from '@/components/MushafSessionView'
import { loadHomeworkItems } from '@/lib/homeworkItems'

export default async function StudentPersonalMushafPage() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/login')

  const [result, homework] = await Promise.all([getOrCreateMushafSession(supabase, userId, null), loadHomeworkItems(supabase, { studentId: userId })])
  if ('error' in result) return notFound()

  return (
    <main className="container mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">My Mushaf</h1>
      <MushafSessionView role="owner" sessionId={result.session.id} teacherId={null} currentUserId={userId} initialPage={result.session.current_page}
        homework={{ items: homework, canTick: true, showTeacher: true }}
      />
    </main>
  )
}
