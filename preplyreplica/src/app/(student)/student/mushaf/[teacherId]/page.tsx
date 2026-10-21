import { notFound, redirect } from 'next/navigation'
import { getOrCreateMushafSession } from '@preply-clone/mushaf'
import { createServerClient } from '@/lib/supabase/server'
import { getPairLessons } from '@/lib/mushafLessons'
import { MushafSessionView } from '@/components/MushafSessionView'

export default async function StudentMushafPage({
  params,
  searchParams,
}: {
  params: { teacherId: string }
  searchParams: { booking?: string }
}) {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/login')

  // Independent lookups, fetched together in one round trip. The database refuses to
  // create a shared session for a pair with no booking or conversation.
  const [{ data: teacher }, result, { lessons, activeBookingId }] = await Promise.all([
    supabase.from('teacher_profiles').select('id, profiles(full_name)').eq('id', params.teacherId).single(),
    getOrCreateMushafSession(supabase, userId, params.teacherId),
    getPairLessons(supabase, userId, params.teacherId, searchParams.booking),
  ])
  if (!teacher || 'error' in result) return notFound()

  return (
    <main className="container mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Mushaf · {teacher.profiles?.full_name ?? 'Teacher'}</h1>
      <MushafSessionView
        role="student"
        sessionId={result.session.id}
        teacherId={params.teacherId}
        currentUserId={userId}
        initialPage={result.session.current_page}
        bookingId={activeBookingId}
        lessons={lessons}
      />
    </main>
  )
}
