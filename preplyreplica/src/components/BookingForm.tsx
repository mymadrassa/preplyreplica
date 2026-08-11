// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/BookingForm.tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { FormMessage } from '@/components/FormMessage'

interface BookingFormProps {
  teacher: {
    id: string
    hourly_rate: number
    subjects: string[]
    languages: string[]
  }
}

function formatTimeLabel(time: string) {
  const [hours24, minutes] = time.split(':').map(Number)
  const period = hours24 < 12 ? 'AM' : 'PM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function BookingForm({ teacher }: BookingFormProps) {
  const [subject, setSubject] = useState(teacher.subjects?.[0] || '')
  const [language, setLanguage] = useState(teacher.languages?.[0] || '')
  const [duration, setDuration] = useState('60')
  const [date, setDate] = useState(todayIsoDate())
  const [startTime, setStartTime] = useState('')
  const [availableStartTimes, setAvailableStartTimes] = useState<string[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!date) return
    let cancelled = false
    setLoadingTimes(true)
    setStartTime('')

    fetch(`/api/teachers/${teacher.id}/availability?date=${date}&duration=${duration}`)
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return
        setAvailableStartTimes(result.startTimes || [])
      })
      .catch(() => {
        if (!cancelled) setAvailableStartTimes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTimes(false)
      })

    return () => {
      cancelled = true
    }
  }, [teacher.id, date, duration])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!startTime) {
      setError('Please pick a start time.')
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
        startAt: new Date(`${date}T${startTime}`).toISOString(),
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

      <label className="block text-sm font-medium text-slate-700">
        <span>Date</span>
        <input
          type="date"
          value={date}
          min={todayIsoDate()}
          onChange={(event) => setDate(event.target.value)}
          required
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition-all hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
      </label>

      <div>
        <span className="block text-sm font-medium text-slate-700">Available times</span>
        <div className="mt-2">
          {loadingTimes ? (
            <p className="text-sm text-slate-500">Checking availability…</p>
          ) : availableStartTimes.length ? (
            <div className="flex flex-wrap gap-2">
              {availableStartTimes.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setStartTime(time)}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
                    startTime === time
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {formatTimeLabel(time)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No open times on this date for a {duration}-minute lesson. Try another date.</p>
          )}
        </div>
      </div>

      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <Button type="submit" loading={loading} disabled={!startTime}>{loading ? 'Processing…' : 'Continue to payment'}</Button>
    </form>
  )
}
