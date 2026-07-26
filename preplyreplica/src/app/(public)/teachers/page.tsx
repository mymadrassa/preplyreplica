// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(public)/teachers/page.tsx
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { TeacherCard } from '@/components/TeacherCard'

export default async function TeachersPage() {
  const supabase = createServerClient()
  const { data: teachers } = await supabase
    .from('teacher_profiles')
    .select('*, profiles(*)')
    .eq('status', 'approved')
    .order('rating_avg', { ascending: false })

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Teachers</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Approved tutors available now</h1>
        </div>
        <Link href="/auth/register">
          <span className="inline-flex items-center rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Become a teacher</span>
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {teachers?.length ? (
          teachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={{
                id: teacher.id,
                full_name: teacher.profiles?.full_name ?? 'Teacher',
                headline: teacher.headline,
                rating_avg: Number(teacher.rating_avg),
                hourly_rate: teacher.hourly_rate,
                subjects: teacher.subjects,
                languages: teacher.languages,
                status: teacher.status,
              }}
            />
          ))
        ) : (
          <p className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">No approved teachers are available yet.</p>
        )}
      </div>
    </main>
  )
}
