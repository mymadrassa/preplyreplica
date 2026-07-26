// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/BookingForm.tsx
'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'

interface BookingFormProps {
  teacher: {
    id: string
    hourly_rate: number
    subjects: string[]
    languages: string[]
  }
}

export function BookingForm({ teacher }: BookingFormProps) {
  const supabase = createBrowserClient()
  const [subject, setSubject] = useState(teacher.subjects?.[0] || '')
  const [language, setLanguage] = useState(teacher.languages?.[0] || '')
  const [duration, setDuration] = useState('60')
  const [startAt, setStartAt] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const response = await fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        teacherId: teacher.id,
        subject,
        language,
        duration: Number(duration),
        startAt: new Date(startAt).toISOString(),
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Start date" name="start_date" type="date" value={startAt.split('T')[0]} onChange={(event) => setStartAt(`${event.target.value}T${startAt.split('T')[1] ?? '12:00'}`)} required />
        <Input label="Start time" name="start_time" type="time" value={startAt.split('T')[1] ?? ''} onChange={(event) => setStartAt(`${startAt.split('T')[0] || new Date().toISOString().slice(0, 10)}T${event.target.value}`)} required />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={loading}>{loading ? 'Processing…' : 'Continue to payment'}</Button>
    </form>
  )
}
