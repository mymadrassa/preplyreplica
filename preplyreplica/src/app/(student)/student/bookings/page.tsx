// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(student)/bookings/page.tsx
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { ArrowLeft, CalendarPlus, CalendarX2, Video } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { TextArea } from '@/components/TextArea'
import { StatusBadge } from '@/components/StatusBadge'
import { SubmitButton } from '@/components/SubmitButton'

async function submitReview(formData: FormData) {
  'use server'
  const bookingId = formData.get('bookingId') as string
  const rating = Number(formData.get('rating'))
  const comment = String(formData.get('comment') || '')

  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) return

  await supabase.from('reviews').insert({ booking_id: bookingId, student_id: userId, teacher_id: formData.get('teacherId') as string, rating, comment })
  revalidatePath('/student/bookings')
}

export default async function StudentBookingsPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id

  if (!userId) {
    return (
      <main className="container mx-auto px-4 py-12">
        <p className="text-slate-700">Please log in to see your bookings.</p>
      </main>
    )
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, teacher_profiles(*, profiles(*), reviews(*))')
    .eq('student_id', userId)
    .order('start_at', { ascending: false })

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Student bookings</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your lesson history</h1>
        </div>
        <Link href="/student/dashboard" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>
      <div className="grid gap-6">
        {bookings?.length ? (
          bookings.map((booking) => (
            <Card key={booking.id}>
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{booking.subject}</p>
                    <h2 className="text-xl font-semibold text-slate-900">{booking.teacher_profiles?.profiles?.full_name}</h2>
                  </div>
                  <div className="text-right text-slate-600">
                    <p>{new Date(booking.start_at).toLocaleString()}</p>
                    <div className="mt-1">
                      <StatusBadge status={booking.status} />
                    </div>
                    {booking.status === 'confirmed' ? (
                      <div className="mt-2 flex flex-col items-end gap-1">
                        <Link href={`/session/${booking.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                          <Video className="h-4 w-4" aria-hidden="true" />
                          Join session
                        </Link>
                        <a href={`/api/bookings/${booking.id}/calendar`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
                          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                          Add to calendar
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
                {booking.status === 'completed' ? (
                  <form action={submitReview} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <input type="hidden" name="teacherId" value={booking.teacher_profiles?.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label="Rating (1-5)" name="rating" type="number" min={1} max={5} required />
                      <TextArea label="Comment" name="comment" rows={3} />
                    </div>
                    <SubmitButton>Submit review</SubmitButton>
                  </form>
                ) : null}
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <div className="flex items-center gap-3 text-slate-600">
              <CalendarX2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
              <p>No bookings found. Book a lesson to get started.</p>
            </div>
          </Card>
        )}
      </div>
    </main>
  )
}
