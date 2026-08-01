// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/TeacherCard.tsx
import Link from 'next/link'
import { RatingStars } from '@/components/RatingStars'
import { StatusBadge } from '@/components/StatusBadge'

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
    <Link href={`/teachers/${teacher.id}`} className="block rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-900">{teacher.full_name}</p>
          <p className="mt-1 text-sm text-slate-600">{teacher.headline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span className="font-semibold text-slate-900">£{teacher.hourly_rate}/hr</span>
          {teacher.subjects.length ? <span>{teacher.subjects.slice(0, 3).join(', ')}</span> : null}
          {teacher.languages.length ? <span>{teacher.languages.slice(0, 3).join(', ')}</span> : null}
        </div>
        <div className="flex items-center justify-between">
          <RatingStars value={teacher.rating_avg} />
          <StatusBadge status={teacher.status} />
        </div>
      </div>
    </Link>
  )
}
