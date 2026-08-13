// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/BookingForm.tsx
'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { FormMessage } from '@/components/FormMessage'
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar'
import { MIN_BOOKING_NOTICE_HOURS } from '@/lib/constants'
import type { AvailabilitySlot, AvailabilityException, OccupyingBooking } from '@/lib/availability'

interface BookingFormProps {
  teacher: {
    id: string
    hourly_rate: number
    subjects: string[]
    languages: string[]
  }
}

function dateKeyLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function BookingForm({ teacher }: BookingFormProps) {
  const [subject, setSubject] = useState(teacher.subjects?.[0] || '')
  const [language, setLanguage] = useState(teacher.languages?.[0] || '')
  const [duration, setDuration] = useState('60')
  const [selectedStart, setSelectedStart] = useState<Date | null>(null)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([])
  const [bookings, setBookings] = useState<OccupyingBooking[]>([])
  const [loadingWeek, setLoadingWeek] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadWeek = useCallback(
    (weekStart: Date) => {
      // Changing the visible week drops any slot the student had picked in a
      // different week — carrying it forward silently could submit a stale
      // selection they no longer see highlighted.
      setSelectedStart(null)
      setLoadingWeek(true)
      fetch(`/api/teachers/${teacher.id}/availability?range=week&weekStart=${dateKeyLocal(weekStart)}`)
        .then((response) => response.json())
        .then((result) => {
          setSlots(result.slots || [])
          setExceptions(result.exceptions || [])
          setBookings(result.bookings || [])
        })
        .catch(() => {
          setSlots([])
          setExceptions([])
          setBookings([])
        })
        .finally(() => setLoadingWeek(false))
    },
    [teacher.id]
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!selectedStart) {
      setError('Please pick a time on the calendar.')
      return
    }

    setLoading(true)

    const response = await fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        teacherId: teacher.id,
        subject,
        language,
        duration: Number(duration),
        startAt: selectedStart.toISOString(),
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(result.error || 'Failed to create booking.')
      return
    }

    window.location.href = result.checkoutUrl
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-6">
      <h2 className="text-xl font-semibold text-slate-900">Book a lesson</h2>
      <Select label="Subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} options={teacher.subjects.map((subject) => ({ value: subject, label: subject }))} required />
      <Select label="Language" name="language" value={language} onChange={(event) => setLanguage(event.target.value)} options={teacher.languages.map((language) => ({ value: language, label: language }))} required />
      <Select label="Duration" name="duration" value={duration} onChange={(event) => setDuration(event.target.value)} options={[{ value: '30', label: '30 minutes' }, { value: '45', label: '45 minutes' }, { value: '60', label: '60 minutes' }, { value: '90', label: '90 minutes' }]} required />

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">Pick a time</span>
        {loadingWeek ? <p className="mb-2 text-sm text-slate-500">Loading availability…</p> : null}
        <AvailabilityCalendar
          mode="booking"
          slots={slots}
          exceptions={exceptions}
          bookings={bookings}
          durationMinutes={Number(duration)}
          selectedStart={selectedStart}
          onSelectStart={setSelectedStart}
          minNoticeHours={MIN_BOOKING_NOTICE_HOURS}
          onVisibleWeekChange={loadWeek}
        />
        {selectedStart ? (
          <p className="mt-3 text-sm text-slate-700">
            Selected: <strong>{selectedStart.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</strong>
          </p>
        ) : null}
      </div>

      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <Button type="submit" loading={loading} disabled={!selectedStart}>{loading ? 'Processing…' : 'Continue to payment'}</Button>
    </form>
  )
}
