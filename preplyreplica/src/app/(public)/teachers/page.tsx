// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(public)/teachers/page.tsx
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { TeacherCard } from '@/components/TeacherCard'
import { Select } from '@/components/Select'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { SUBJECTS, LANGUAGES } from '@/lib/constants'

interface TeachersPageProps {
  searchParams: {
    subject?: string
    language?: string
    maxPrice?: string
    sort?: string
  }
}

export default async function TeachersPage({ searchParams }: TeachersPageProps) {
  const supabase = createServerClient()
  const { data: teachers } = await supabase
    .from('teacher_profiles')
    .select('*, profiles(*)')
    .eq('status', 'approved')
    .order('rating_avg', { ascending: false })

  const allTeachers = teachers ?? []
  const subjectOptions = SUBJECTS
  const languageOptions = LANGUAGES

  const subject = searchParams.subject ?? ''
  const language = searchParams.language ?? ''
  const maxPrice = searchParams.maxPrice ?? ''
  const sort = searchParams.sort ?? 'rating'

  const filteredTeachers = allTeachers
    .filter((teacher) => (subject ? teacher.subjects?.includes(subject) : true))
    .filter((teacher) => (language ? teacher.languages?.includes(language) : true))
    .filter((teacher) => (maxPrice ? teacher.hourly_rate <= Number(maxPrice) : true))
    .sort((a, b) => {
      if (sort === 'price_asc') return a.hourly_rate - b.hourly_rate
      if (sort === 'price_desc') return b.hourly_rate - a.hourly_rate
      return Number(b.rating_avg) - Number(a.rating_avg)
    })

  const hasActiveFilters = Boolean(subject || language || maxPrice || sort !== 'rating')

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

      <form method="get" className="mb-10 grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Subject"
          name="subject"
          defaultValue={subject}
          options={[{ value: '', label: 'Any subject' }, ...subjectOptions.map((item) => ({ value: item, label: item }))]}
        />
        <Select
          label="Language"
          name="language"
          defaultValue={language}
          options={[{ value: '', label: 'Any language' }, ...languageOptions.map((item) => ({ value: item, label: item }))]}
        />
        <Input label="Max hourly rate" name="maxPrice" type="number" min={0} defaultValue={maxPrice} placeholder="Any price" />
        <Select
          label="Sort by"
          name="sort"
          defaultValue={sort}
          options={[
            { value: 'rating', label: 'Top rated' },
            { value: 'price_asc', label: 'Price: low to high' },
            { value: 'price_desc', label: 'Price: high to low' },
          ]}
        />
        <div className="flex items-end justify-end gap-3 sm:col-span-2 lg:col-span-4">
          {hasActiveFilters ? (
            <Link href="/teachers" className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50">
              Clear filters
            </Link>
          ) : null}
          <Button type="submit">Search</Button>
        </div>
      </form>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredTeachers.length ? (
          filteredTeachers.map((teacher) => (
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
          <p className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-600 md:col-span-2 lg:col-span-3">
            {allTeachers.length ? 'No teachers match your filters. Try widening your search.' : 'No approved teachers are available yet.'}
          </p>
        )}
      </div>
    </main>
  )
}
