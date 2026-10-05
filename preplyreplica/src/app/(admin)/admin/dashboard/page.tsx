// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(admin)/dashboard/page.tsx
import Link from 'next/link'
import { CalendarCheck, GraduationCap, Search, TrendingUp, UserCog, Users as UsersIcon, Wallet, Banknote } from 'lucide-react'
import type { Database } from '@/types/database'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Select } from '@/components/Select'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { AdminTeachersTable, type AdminTeacherRow } from '@/components/AdminTeachersTable'
import { AdminPayoutConfirmCard } from '@/components/AdminPayoutConfirmCard'
import { EarningsTrendChart } from '@/components/EarningsTrendChart'
import { StatusBadge } from '@/components/StatusBadge'
import { formatBookingDateTime } from '@/lib/format'
import { toPounds } from '@/lib/pricing'

type PaymentRow = Database['public']['Tables']['payments']['Row']
type TeacherDocument = Database['public']['Tables']['teacher_documents']['Row']
type TeacherProfileWithRelations = Database['public']['Tables']['teacher_profiles']['Row'] & {
  created_at: string
  profiles: Database['public']['Tables']['profiles']['Row'] | null
  teacher_documents: TeacherDocument[]
  bookings: { payments: PaymentRow[] }[]
}

const TEACHER_STATUSES = ['approved', 'pending', 'rejected', 'suspended'] as const
const PAGE_SIZE = 20

interface AdminDashboardPageProps {
  searchParams: {
    status?: string
    q?: string
    from?: string
    to?: string
    page?: string
    sortBy?: string
    sortDir?: string
  }
}

function monthKey(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const supabase = createServerClient()

  const status = searchParams.status ?? ''
  const q = searchParams.q ?? ''
  const from = searchParams.from ?? ''
  const to = searchParams.to ?? ''
  const page = Math.max(1, Number(searchParams.page) || 1)
  const sortBy = (['name', 'created_at', 'status'].includes(searchParams.sortBy ?? '') ? searchParams.sortBy : 'created_at') as 'name' | 'created_at' | 'status'
  const sortDir = (searchParams.sortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'

  let teachersQuery = supabase
    .from('teacher_profiles')
    .select('*, profiles(*), teacher_documents(*), bookings(payments(*))')
  if (status) teachersQuery = teachersQuery.eq('status', status as 'pending' | 'approved' | 'rejected' | 'suspended')
  if (from) teachersQuery = teachersQuery.gte('created_at', from)
  if (to) teachersQuery = teachersQuery.lte('created_at', `${to}T23:59:59`)

  const [
    { data: teachersRaw },
    { count: bookingCount },
    { count: teacherCount },
    { count: studentCount },
    { data: teacherStatusRows },
    { data: allPayments },
    { data: upcomingSessions },
    { data: awaitingPayoutConfirmation },
  ] = await Promise.all([
    teachersQuery,
    supabase.from('bookings').select('id', { count: 'exact' }),
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'teacher'),
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'student'),
    supabase.from('teacher_profiles').select('status'),
    supabase.from('payments').select('platform_fee, teacher_fee, payout_at, status, created_at'),
    supabase
      .from('bookings')
      .select('id, subject, start_at, status, teacher_profiles(profiles(full_name)), profiles!student_id(full_name, email)')
      .eq('status', 'confirmed')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(20),
    supabase
      .from('bookings')
      .select('id, subject, start_at, teacher_confirmed_at, student_joined_at, teacher_joined_at, teacher_profiles(profiles(full_name)), profiles!student_id(full_name, email)')
      .eq('status', 'confirmed')
      .not('teacher_confirmed_at', 'is', null)
      .is('admin_confirmed_at', null)
      .order('teacher_confirmed_at', { ascending: true }),
  ])

  const allTeachers = ((teachersRaw as TeacherProfileWithRelations[] | null) ?? [])

  const normalizedQuery = q.trim().toLowerCase()
  const filteredTeachers = normalizedQuery
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

  const sortedTeachers = [...filteredTeachers].sort((a, b) => {
    let result = 0
    if (sortBy === 'name') {
      const nameA = a.profiles?.full_name || a.profiles?.email || ''
      const nameB = b.profiles?.full_name || b.profiles?.email || ''
      result = nameA.localeCompare(nameB)
    } else if (sortBy === 'status') {
      result = a.status.localeCompare(b.status)
    } else {
      result = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    return sortDir === 'asc' ? result : -result
  })

  const totalCount = sortedTeachers.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageTeachers = sortedTeachers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_TEACHER_DOCS || 'teacher-documents'
  const teacherRows: AdminTeacherRow[] = await Promise.all(
    pageTeachers.map(async (teacher) => {
      const documentUrls = await Promise.all(
        (teacher.teacher_documents ?? []).map(async (doc) => {
          const { data } = await supabase.storage.from(bucket).createSignedUrl(doc.bucket_path, 3600)
          return { name: doc.bucket_path.split('/').pop() || doc.bucket_path, url: data?.signedUrl || '' }
        })
      )
      const payments = (teacher.bookings ?? []).flatMap((booking) => booking.payments ?? [])
      const awaitingPayoutPence = payments.filter((p) => p.status === 'succeeded' && !p.payout_at).reduce((sum, p) => sum + p.teacher_fee, 0)
      const paidOutPence = payments.filter((p) => p.status === 'succeeded' && p.payout_at).reduce((sum, p) => sum + p.teacher_fee, 0)

      return {
        id: teacher.id,
        name: teacher.profiles?.full_name || teacher.profiles?.email || 'Teacher',
        email: teacher.profiles?.email ?? null,
        avatarUrl: teacher.profiles?.avatar_url ?? null,
        headline: teacher.headline,
        bio: teacher.bio,
        subjects: teacher.subjects ?? [],
        languages: teacher.languages ?? [],
        hourlyRate: teacher.hourly_rate,
        stripeChargesEnabled: teacher.stripe_charges_enabled,
        videoUrl: teacher.video_url,
        documentUrls,
        status: teacher.status,
        createdAt: teacher.created_at,
        awaitingPayoutPence,
        paidOutPence,
      }
    })
  )

  const payments = (allPayments as PaymentRow[] | null) ?? []
  const succeededPayments = payments.filter((p) => p.status === 'succeeded')
  const platformBalancePence = succeededPayments.reduce((sum, p) => sum + p.platform_fee, 0)
  const paidToTeachersPence = succeededPayments.filter((p) => p.payout_at).reduce((sum, p) => sum + p.teacher_fee, 0)
  const awaitingTeacherPayoutPence = succeededPayments.filter((p) => !p.payout_at).reduce((sum, p) => sum + p.teacher_fee, 0)

  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const month = d.toLocaleDateString('en-GB', { month: 'short' })
    const amountPence = succeededPayments.filter((p) => monthKey(p.created_at) === key).reduce((sum, p) => sum + p.platform_fee, 0)
    return { month, amountPence }
  })

  const statusBreakdown = TEACHER_STATUSES.map((s) => ({
    status: s,
    count: (teacherStatusRows ?? []).filter((row) => (row as { status: string }).status === s).length,
  }))

  const hasActiveFilters = Boolean(status || q || from || to)
  const currentParams = { status, q, from, to }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Admin dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Platform overview</h1>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <UserCog className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Pending teachers</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{statusBreakdown.find((s) => s.status === 'pending')?.count ?? 0}</p>
        </Card>
        <Card>
          <CalendarCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Total bookings</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{bookingCount ?? 0}</p>
        </Card>
        <Card>
          <UsersIcon className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Students</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{studentCount ?? 0}</p>
        </Card>
        <Card>
          <GraduationCap className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Teachers</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{teacherCount ?? 0}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <Wallet className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Platform balance</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">£{toPounds(platformBalancePence).toFixed(2)}</p>
          <p className="mt-1 text-sm text-slate-500">Commission collected to date</p>
        </Card>
        <Card>
          <Banknote className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Paid to teachers</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">£{toPounds(paidToTeachersPence).toFixed(2)}</p>
          <p className="mt-1 text-sm text-slate-500">Released after admin confirmation</p>
        </Card>
        <Card>
          <TrendingUp className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Awaiting teacher payout</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">£{toPounds(awaitingTeacherPayoutPence).toFixed(2)}</p>
          <p className="mt-1 text-sm text-slate-500">Captured, not yet paid out</p>
        </Card>
      </div>

      <Card className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Platform commission trend</h2>
        <div className="mt-4">
          <EarningsTrendChart data={trendData} />
        </div>
      </Card>

      <Card className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Teacher approval status</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {statusBreakdown.map(({ status: s, count }) => (
            <div key={s} className="rounded-2xl border border-slate-200 p-4">
              <StatusBadge status={s} />
              <p className="mt-2 text-2xl font-semibold text-slate-900">{count}</p>
            </div>
          ))}
        </div>
      </Card>

      {awaitingPayoutConfirmation?.length ? (
        <div className="mt-10">
          <h2 className="text-2xl font-semibold text-slate-900">Awaiting payout confirmation</h2>
          <p className="mt-1 text-sm text-slate-500">
            The teacher marked these sessions complete. Confirm each one to release the teacher's payout.
          </p>
          <div className="mt-4 grid gap-4">
            {awaitingPayoutConfirmation.map((booking) => (
              <AdminPayoutConfirmCard
                key={booking.id}
                bookingId={booking.id}
                subject={booking.subject}
                startAt={booking.start_at}
                teacherConfirmedAt={booking.teacher_confirmed_at as string}
                teacherName={(booking as any).teacher_profiles?.profiles?.full_name || 'Teacher'}
                studentName={(booking as any).profiles?.full_name || (booking as any).profiles?.email || 'Student'}
                studentJoinedAt={booking.student_joined_at as string | null}
                teacherJoinedAt={booking.teacher_joined_at as string | null}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-10">
        <h2 className="text-2xl font-semibold text-slate-900">Upcoming sessions</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Teacher</th>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Date &amp; time</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcomingSessions?.length ? (
                  upcomingSessions.map((session) => (
                    <tr key={session.id} className="align-middle transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-900">{(session as any).teacher_profiles?.profiles?.full_name || 'Teacher'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-900">{(session as any).profiles?.full_name || (session as any).profiles?.email || 'Student'}</td>
                      <td className="px-4 py-3 text-slate-700">{session.subject}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatBookingDateTime(session.start_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={session.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No upcoming confirmed sessions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-semibold text-slate-900">Teachers</h2>
        <form method="get" className="mt-4 grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:grid-cols-2 lg:grid-cols-5">
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

        <div className="mt-6">
          <AdminTeachersTable rows={teacherRows} page={currentPage} pageSize={PAGE_SIZE} totalCount={totalCount} sortBy={sortBy} sortDir={sortDir} currentParams={currentParams} />
        </div>
      </div>
    </main>
  )
}
