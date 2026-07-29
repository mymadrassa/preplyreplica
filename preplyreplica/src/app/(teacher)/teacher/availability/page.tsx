// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(teacher)/availability/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { SubmitButton } from '@/components/SubmitButton'

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
}

export default async function TeacherAvailabilityPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return <p className="container mx-auto px-4 py-12 text-slate-700">Please sign in to manage availability.</p>
  }

  const [{ data: slots }, { data: exceptions }] = await Promise.all([
    supabase.from('availability_slots').select('*').eq('teacher_id', userId).order('weekday'),
    supabase.from('availability_exceptions').select('*').eq('teacher_id', userId).order('exception_date', { ascending: true }),
  ])

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
        <section className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Availability</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Weekly schedule and exceptions</h1>
          </div>
          <Card>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Weekly schedule</h2>
              {slots?.length ? (
                <div className="grid gap-3">
                  {slots.map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                      <p>Day {slot.weekday}: {slot.start_time} — {slot.end_time}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600">No weekly slots configured yet.</p>
              )}
            </div>
          </Card>
          <Card>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Exceptions</h2>
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
              <Select label="Weekday" name="weekday" options={['0','1','2','3','4','5','6'].map((day) => ({ value: day, label: `Day ${day}` }))} required />
              <Input label="Start time" name="start_time" type="time" required />
              <Input label="End time" name="end_time" type="time" required />
              <SubmitButton>Save slot</SubmitButton>
            </form>
          </Card>
          <Card>
            <form action={addException} className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Add exception</h2>
              <Input label="Date" name="exception_date" type="date" required />
              <Select label="Type" name="exception_type" options={[{ value: 'blocked', label: 'Blocked' }, { value: 'added', label: 'Added' }]} required />
              <Input label="Start time" name="start_time" type="time" />
              <Input label="End time" name="end_time" type="time" />
              <SubmitButton>Save exception</SubmitButton>
            </form>
          </Card>
        </aside>
      </div>
    </main>
  )
}
