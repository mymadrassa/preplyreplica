// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/TeacherCard.tsx
import Link from 'next/link'
import { RatingStars } from '@/components/RatingStars'

interface TeacherCardProps {
  teacher: {
    id: string
    full_name: string
    headline: string | null
    rating_avg: number
    hourly_rate: number
    subjects: string[]
    languages: string[]
    status: string
  }
}

export function TeacherCard({ teacher }: TeacherCardProps) {
  return (
    <Link href={`/teachers/${teacher.id}`} className="block rounded-3xl border border-slate-200 bg-white p-6 transition hover:shadow-lg">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-900">{teacher.full_name}</p>
          <p className="mt-1 text-sm text-slate-600">{teacher.headline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span>£{teacher.hourly_rate}/hr</span>
          <span>{teacher.subjects.slice(0, 3).join(', ')}</span>
          <span>{teacher.languages.slice(0, 3).join(', ')}</span>
        </div>
        <div className="flex items-center justify-between">
          <RatingStars value={teacher.rating_avg} />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-600">{teacher.status}</span>
        </div>
      </div>
    </Link>
  )
}
