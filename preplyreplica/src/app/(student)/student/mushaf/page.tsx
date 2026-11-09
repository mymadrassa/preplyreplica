import { notFound, redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
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

  const [result, homework, { data: shared }] = await Promise.all([
    getOrCreateMushafSession(supabase, userId, null),
    loadHomeworkItems(supabase, { studentId: userId }),
    // The student's Mushafs with their teachers: the teachers' marks show here too, read-only.
    (supabase as unknown as SupabaseClient).from('mushaf_sessions').select('id, teacher_id').eq('student_id', userId).not('teacher_id', 'is', null),
  ])
  if ('error' in result) return notFound()
  const linked = ((shared ?? []) as { id: string; teacher_id: string }[]).map((s) => ({ sessionId: s.id, teacherId: s.teacher_id }))

  return (
    <main className="container mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">My Mushaf</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        {linked.length
          ? 'Your teacher’s marks from your lessons show here (labelled “Teacher”). Add your own highlights, errors, comments and drawings on top: only you can see and change yours.'
          : 'Your own space to revise: mark words and draw. Your teacher’s marks will show here after your lessons.'}
      </p>
      <MushafSessionView
        role="owner"
        sessionId={result.session.id}
        teacherId={null}
        currentUserId={userId}
        initialPage={result.session.current_page}
        linked={linked}
        homework={{ items: homework, canTick: true, showTeacher: true }}
      />
    </main>
  )
}
