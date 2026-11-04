import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadHomeworkItems } from '@/lib/homeworkItems'
import { MarkHomeworkSeen } from './MarkHomeworkSeen'
import { HomeworkList } from './HomeworkList'

export default async function StudentHomeworkPage() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/login')

  const items = await loadHomeworkItems(supabase, { studentId: userId })

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      {items.some((item) => item.unseen) ? <MarkHomeworkSeen /> : null}
      <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Cahier de texte</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your homework</h1>
      <p className="mt-2 text-slate-600">What your teachers asked you to revise and memorise after each lesson. Tick it off when you&apos;re done.</p>
      <HomeworkList items={items} />
    </main>
  )
}
