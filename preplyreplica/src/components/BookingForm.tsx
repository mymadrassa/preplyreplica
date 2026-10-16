// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/BookingForm.tsx
'use client'

import { useCallback, useMemo, useState } from 'react'
import { Info, Gift } from 'lucide-react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { FormMessage } from '@/components/FormMessage'
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar'
import { CANCELLATION_CUTOFF_HOURS, MIN_BOOKING_NOTICE_HOURS } from '@/lib/constants'
import { calculatePricing } from '@/lib/pricing'
import type { AvailabilitySlot, AvailabilityException, OccupyingBooking } from '@/lib/availability'

interface BookingFormProps {
  teacher: {
    id: string
    hourly_rate: number
    subjects: string[]
    languages: string[]
  }
  /** Whether the current student has never had a non-cancelled/rejected booking with this teacher — the only case a free trial can be offered. */
  isTrialEligible?: boolean
  /** Pre-checks the trial checkbox — used when the student arrives via the onboarding wizard's `?intent=trial` link. */
  defaultAsTrial?: boolean
}

function dateKeyLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function BookingForm({ teacher, isTrialEligible = false, defaultAsTrial = false }: BookingFormProps) {
  const [subject, setSubject] = useState(teacher.subjects?.[0] || '')
  const [language, setLanguage] = useState(teacher.languages?.[0] || '')
  const [duration, setDuration] = useState('60')
  const [asTrial, setAsTrial] = useState(isTrialEligible && defaultAsTrial)
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

  const pricing = useMemo(() => calculatePricing(teacher.hourly_rate, Number(duration) / 60, asTrial), [teacher.hourly_rate, duration, asTrial])
  const normalPricing = useMemo(() => calculatePricing(teacher.hourly_rate, Number(duration) / 60, false), [teacher.hourly_rate, duration])

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
        isTrial: isTrialEligible && asTrial,
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

      {isTrialEligible ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          <input type="checkbox" checked={asTrial} onChange={(event) => setAsTrial(event.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-brand-300 text-brand-600 focus:ring-brand-500" />
          <span className="flex items-start gap-2">
            <Gift className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" aria-hidden="true" />
            <span>
              <span className="block font-semibold">Book this as a free trial</span>
              You pay only the teacher's rate — no platform fee. You can only do this once with this teacher.
            </span>
          </span>
        </label>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
        {asTrial && isTrialEligible ? (
          <>
            <p className="font-semibold text-slate-900">You'll pay £{pricing.totalStudentPays.toFixed(2)} for this trial</p>
            <p className="mt-0.5 text-xs text-slate-500">Regular price would be £{normalPricing.totalStudentPays.toFixed(2)} — no platform fee applied</p>
          </>
        ) : (
          <p className="font-semibold text-slate-900">You'll pay £{pricing.totalStudentPays.toFixed(2)}</p>
        )}
      </div>

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

      <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
        <p>
          Free cancellation up to {CANCELLATION_CUTOFF_HOURS} hours before your lesson for a full refund. Cancelling later than that, or not at all, is non-refundable.
        </p>
      </div>

      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <Button type="submit" loading={loading} disabled={!selectedStart}>{loading ? 'Processing…' : 'Continue to payment'}</Button>
    </form>
  )
}
