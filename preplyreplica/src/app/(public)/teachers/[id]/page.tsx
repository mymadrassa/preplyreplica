// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(public)/teachers/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { BookingForm } from '@/components/BookingForm'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'

interface TeacherPageProps {
  params: {
    id: string
  }
}

export default async function TeacherDetailsPage({ params }: TeacherPageProps) {
  const supabase = createServerClient()
  const { data: teacher, error } = await supabase
    .from('teacher_profiles')
    .select('*, profiles(*), availability_slots(*), availability_exceptions(*)')
    .eq('id', params.id)
    .single()

  if (error || !teacher || teacher.status !== 'approved') {
    return notFound()
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-[1.7fr_1fr]">
        <section className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl font-semibold text-slate-900">{teacher.profiles?.full_name ?? 'Teacher profile'}</h1>
            <StatusBadge status={teacher.status} />
          </div>
          <p className="text-slate-600">{teacher.headline}</p>
          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">About</p>
              <p className="mt-2 text-slate-700">{teacher.bio}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Subjects</p>
                <p className="mt-2 text-slate-700">{teacher.subjects?.join(', ') || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Languages</p>
                <p className="mt-2 text-slate-700">{teacher.languages?.join(', ') || 'Not specified'}</p>
              </div>
            </div>
          </div>
          {teacher.video_url ? (
            <div className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-950">
              <iframe
                className="h-72 w-full"
                src={teacher.video_url}
                title="Teacher introduction"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : null}
          <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Availability</p>
            {teacher.availability_slots?.length ? (
              teacher.availability_slots.map((slot) => (
                <div key={slot.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold">Weekday {slot.weekday}</p>
                  <p>{slot.start_time} – {slot.end_time}</p>
                </div>
              ))
            ) : (
              <p>No weekly availability slots defined yet.</p>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <Card>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.2em] text-brand-700">Hourly rate</p>
              <p className="text-3xl font-semibold text-slate-900">£{teacher.hourly_rate}</p>
              <p className="text-slate-600">Pay securely with Stripe and join the Jitsi meeting when the lesson starts.</p>
            </div>
          </Card>
          <BookingForm teacher={{ id: teacher.id, hourly_rate: teacher.hourly_rate, subjects: teacher.subjects, languages: teacher.languages }} />
        </aside>
      </div>
    </main>
  )
}
