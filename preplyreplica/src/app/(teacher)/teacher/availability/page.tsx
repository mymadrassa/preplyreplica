// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(teacher)/availability/page.tsx
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Select } from '@/components/Select'
import { SubmitButton } from '@/components/SubmitButton'
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar'
import { WeeklyScheduleList } from '@/components/WeeklyScheduleList'
import { WEEKDAYS, TIME_OPTIONS } from '@/lib/constants'

async function addSlot(formData: FormData) {
  'use server'
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) return

  await supabase.from('availability_slots').insert({
    teacher_id: userId,
    weekday: Number(formData.get('weekday')),
    start_time: String(formData.get('start_time')),
    end_time: String(formData.get('end_time')),
  })

  revalidatePath('/teacher/availability')
}

// Monday-first display order; the stored `weekday` value keeps JS's native
// Date.getDay() meaning (0 = Sunday), so this just reorders how slots list.
const WEEKDAY_DISPLAY_ORDER = WEEKDAYS.map((day) => Number(day.value))

interface TeacherAvailabilityPageProps {
  searchParams: {
    date?: string
  }
}

export default async function TeacherAvailabilityPage({ searchParams }: TeacherAvailabilityPageProps) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return <p className="container mx-auto px-4 py-12 text-slate-700">Please sign in to manage availability.</p>
  }

  // A "view in calendar" link (e.g. from the dashboard) can point at a date
  // outside the default window below — parse it first so the range can
  // stretch to include it.
  const initialDate = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? new Date(`${searchParams.date}T00:00:00`) : undefined

  // Wide enough window for the calendar's prev/next month navigation
  // without loading every booking the teacher has ever had.
  const rangeStart = new Date()
  rangeStart.setMonth(rangeStart.getMonth() - 1)
  const rangeEnd = new Date()
  rangeEnd.setMonth(rangeEnd.getMonth() + 2)
  if (initialDate && initialDate < rangeStart) rangeStart.setTime(initialDate.getTime())
  if (initialDate && initialDate > rangeEnd) rangeEnd.setTime(initialDate.getTime())

  const [{ data: slots }, { data: exceptions }, { data: bookings }] = await Promise.all([
    supabase.from('availability_slots').select('*').eq('teacher_id', userId),
    supabase.from('availability_exceptions').select('*').eq('teacher_id', userId).order('exception_date', { ascending: true }),
    supabase
      .from('bookings')
      .select('id, start_at, end_at, subject, status, teacher_confirmed_at, is_trial, profiles!student_id(full_name, email)')
      .eq('teacher_id', userId)
      .gte('start_at', rangeStart.toISOString())
      .lte('start_at', rangeEnd.toISOString()),
  ])

  const sortedSlots = [...(slots || [])].sort(
    (a, b) => WEEKDAY_DISPLAY_ORDER.indexOf(a.weekday) - WEEKDAY_DISPLAY_ORDER.indexOf(b.weekday)
  )

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Availability</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Weekly schedule and calendar</h1>
      </div>

      <Card className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Calendar</h2>
        <AvailabilityCalendar slots={sortedSlots} exceptions={exceptions || []} bookings={(bookings as any) || []} initialDate={initialDate} />
      </Card>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
        <section className="space-y-6">
          <Card>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Weekly schedule</h2>
              <WeeklyScheduleList slots={sortedSlots} />
            </div>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <form action={addSlot} className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Add weekly slot</h2>
              <Select label="Weekday" name="weekday" options={WEEKDAYS} required />
              <Select label="Start time" name="start_time" options={TIME_OPTIONS} required />
              <Select label="End time" name="end_time" options={TIME_OPTIONS} required />
              <SubmitButton>Save slot</SubmitButton>
            </form>
          </Card>
        </aside>
      </div>
    </main>
  )
}
