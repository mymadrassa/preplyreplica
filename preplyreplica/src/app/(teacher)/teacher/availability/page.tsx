// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(teacher)/availability/page.tsx
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
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

async function addException(formData: FormData) {
  'use server'
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) return

  await supabase.from('availability_exceptions').insert({
    teacher_id: userId,
    exception_date: String(formData.get('exception_date')),
    start_time: String(formData.get('start_time')) || null,
    end_time: String(formData.get('end_time')) || null,
    exception_type: String(formData.get('exception_type')) as 'blocked' | 'added',
  })

  revalidatePath('/teacher/availability')
}

// Monday-first display order; the stored `weekday` value keeps JS's native
// Date.getDay() meaning (0 = Sunday), so this just reorders how slots list.
const WEEKDAY_DISPLAY_ORDER = WEEKDAYS.map((day) => Number(day.value))

export default async function TeacherAvailabilityPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return <p className="container mx-auto px-4 py-12 text-slate-700">Please sign in to manage availability.</p>
  }

  // Wide enough window for the calendar's prev/next month navigation
  // without loading every booking the teacher has ever had.
  const rangeStart = new Date()
  rangeStart.setMonth(rangeStart.getMonth() - 1)
  const rangeEnd = new Date()
  rangeEnd.setMonth(rangeEnd.getMonth() + 2)

  const [{ data: slots }, { data: exceptions }, { data: bookings }] = await Promise.all([
    supabase.from('availability_slots').select('*').eq('teacher_id', userId),
    supabase.from('availability_exceptions').select('*').eq('teacher_id', userId).order('exception_date', { ascending: true }),
    supabase
      .from('bookings')
      .select('id, start_at, end_at, subject, status, profiles!student_id(full_name, email)')
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
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Weekly schedule and exceptions</h1>
      </div>

      <Card className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Calendar</h2>
        <AvailabilityCalendar slots={sortedSlots} exceptions={exceptions || []} bookings={(bookings as any) || []} />
      </Card>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
        <section className="space-y-6">
          <Card>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Weekly schedule</h2>
              <WeeklyScheduleList slots={sortedSlots} />
            </div>
          </Card>
          <Card>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Exceptions</h2>
              <p className="text-sm text-slate-500">
                One-off overrides to your usual weekly schedule — e.g. block a specific date you're normally
                available (holiday, appointment), or add availability on a date outside your normal hours.
              </p>
              {exceptions?.length ? (
                <div className="grid gap-3">
                  {exceptions.map((exception) => (
                    <div key={exception.id} className="rounded-2xl bg-slate-50 p-4">
                      <p className="font-semibold">{exception.exception_date}</p>
                      <p>{exception.exception_type} {exception.start_time ? `${exception.start_time} — ${exception.end_time}` : 'full day'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600">No exceptions added.</p>
              )}
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
          <Card>
            <form action={addException} className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Add exception</h2>
              <Input label="Date" name="exception_date" type="date" required />
              <Select label="Type" name="exception_type" options={[{ value: 'blocked', label: 'Blocked' }, { value: 'added', label: 'Added' }]} required />
              <Select label="Start time (optional — leave for full day)" name="start_time" options={[{ value: '', label: '—' }, ...TIME_OPTIONS]} />
              <Select label="End time (optional — leave for full day)" name="end_time" options={[{ value: '', label: '—' }, ...TIME_OPTIONS]} />
              <SubmitButton>Save exception</SubmitButton>
            </form>
          </Card>
        </aside>
      </div>
    </main>
  )
}
