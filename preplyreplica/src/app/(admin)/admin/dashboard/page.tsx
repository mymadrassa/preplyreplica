// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(admin)/dashboard/page.tsx
import Link from 'next/link'
import { CalendarCheck, Search, UserCog, Users as UsersIcon } from 'lucide-react'
import type { Database } from '@/types/database'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Select } from '@/components/Select'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { AdminTeacherCard } from '@/components/AdminTeacherCard'

type TeacherDocument = Database['public']['Tables']['teacher_documents']['Row']
type TeacherProfileWithUser = Database['public']['Tables']['teacher_profiles']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row'] | null
  teacher_documents: TeacherDocument[]
}

interface AdminDashboardPageProps {
  searchParams: {
    status?: string
    q?: string
    from?: string
    to?: string
  }
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const supabase = createServerClient()

  const status = searchParams.status ?? ''
  const q = searchParams.q ?? ''
  const from = searchParams.from ?? ''
  const to = searchParams.to ?? ''

  let query = supabase
    .from('teacher_profiles')
    .select('*, profiles(*), teacher_documents(*)')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  const { data: teachersRaw } = (await query) as { data: TeacherProfileWithUser[] | null }
  const allTeachers = teachersRaw ?? []

  const normalizedQuery = q.trim().toLowerCase()
  const teachers = normalizedQuery
    ? allTeachers.filter((teacher) => {
        const haystack = [
          teacher.profiles?.full_name,
          teacher.profiles?.email,
          teacher.headline,
          teacher.bio,
          ...(teacher.subjects ?? []),
          ...(teacher.languages ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(normalizedQuery)
      })
    : allTeachers

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_TEACHER_DOCS || 'teacher-documents'
  const teachersWithDocumentUrls = await Promise.all(
    teachers.map(async (teacher) => {
      const documentUrls = await Promise.all(
        (teacher.teacher_documents ?? []).map(async (doc) => {
          const { data } = await supabase.storage.from(bucket).createSignedUrl(doc.bucket_path, 3600)
          return { name: doc.bucket_path.split('/').pop() || doc.bucket_path, url: data?.signedUrl || '' }
        })
      )
      return { ...teacher, documentUrls }
    })
  )

  const [{ count: pendingCount }, { count: bookingCount }, { count: teacherCount }, { count: studentCount }] = await Promise.all([
    supabase.from('teacher_profiles').select('id', { count: 'exact' }).eq('status', 'pending'),
    supabase.from('bookings').select('id', { count: 'exact' }),
    supabase.from('teacher_profiles').select('id', { count: 'exact' }),
    supabase.from('profiles').select('id', { count: 'exact' }).neq('role', 'admin'),
  ])
  const totalUsers = (teacherCount ?? 0) + (studentCount ?? 0)

  const hasActiveFilters = Boolean(status || q || from || to)

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Admin dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Review teacher requests</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <UserCog className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Pending teachers</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{pendingCount ?? 0}</p>
        </Card>
        <Card>
          <CalendarCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Total bookings</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{bookingCount ?? 0}</p>
        </Card>
        <Card>
          <UsersIcon className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Users</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalUsers}</p>
        </Card>
      </div>

      <form method="get" className="mt-10 grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-2">
          <Input label="Search" name="q" defaultValue={q} placeholder="Name, email, headline, subject..." />
        </div>
        <Select
          label="Status"
          name="status"
          defaultValue={status}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
        <Input label="From" name="from" type="date" defaultValue={from} />
        <Input label="To" name="to" type="date" defaultValue={to} />
        <div className="flex items-end justify-end gap-3 sm:col-span-2 lg:col-span-5">
          {hasActiveFilters ? (
            <Link href="/admin/dashboard" className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-sm">
              Clear filters
            </Link>
          ) : null}
          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </Button>
        </div>
      </form>

      <div className="mt-6 space-y-4">
        {teachersWithDocumentUrls.length ? (
          teachersWithDocumentUrls.map((teacher) => <AdminTeacherCard key={teacher.id} teacher={teacher} />)
        ) : (
          <Card>
            <p className="text-slate-600">{allTeachers.length ? 'No teachers match your filters.' : 'No teacher requests yet.'}</p>
          </Card>
        )}
      </div>
    </main>
  )
}
