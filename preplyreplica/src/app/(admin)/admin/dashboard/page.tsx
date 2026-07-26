// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(admin)/dashboard/page.tsx
import type { Database } from '@/types/database'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { AdminTeacherCard } from '@/components/AdminTeacherCard'

type TeacherProfileWithUser = Database['public']['Tables']['teacher_profiles']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row'] | null
}

export default async function AdminDashboardPage() {
  const supabase = createServerClient()
  const { data: teachers } = (await supabase
    .from('teacher_profiles')
    .select('*, profiles(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })) as {
      data: TeacherProfileWithUser[] | null
    }

  const [{ count: bookingCount }, { count: teacherCount }, { count: studentCount }] = await Promise.all([
    supabase.from('bookings').select('id', { count: 'exact' }),
    supabase.from('teacher_profiles').select('id', { count: 'exact' }),
    supabase.from('profiles').select('id', { count: 'exact' }).neq('role', 'admin'),
  ])
  const totalUsers = (teacherCount ?? 0) + (studentCount ?? 0)

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Admin dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Review teacher requests</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Pending teachers</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{teachers?.length ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Total bookings</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{bookingCount ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Users</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{totalUsers}</p>
        </Card>
      </div>
      <div className="mt-10 space-y-4">
        {teachers?.length ? (
          (teachers as TeacherProfileWithUser[]).map((teacher) => (
            <AdminTeacherCard key={teacher.id} teacher={teacher} />
          ))
        ) : (
          <Card><p className="text-slate-600">No teacher requests waiting for review.</p></Card>
        )}
      </div>
    </main>
  )
}
