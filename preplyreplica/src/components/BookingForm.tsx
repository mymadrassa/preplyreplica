// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/BookingForm.tsx
'use client'

import { useCallback, useState } from 'react'
import { Info, Gift, Package } from 'lucide-react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { useToast } from '@/components/ToastProvider'
import { LoadingBlock } from '@/components/LoadingBlock'
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar'
import { CANCELLATION_CUTOFF_HOURS, MIN_BOOKING_NOTICE_HOURS } from '@/lib/constants'
import { LESSON_MINUTES, PACKAGE, TRIAL, trialPrice, type Tier } from '@/lib/pricing'
import type { AvailabilitySlot, AvailabilityException, OccupyingBooking } from '@/lib/availability'

interface BookingFormProps {
  teacher: {
    id: string
    hourly_rate: number
    tier: Tier
    subjects: string[]
    languages: string[]
  }
  /** The student's active package with this teacher, if any: lessons booked from it need no payment. */
  activePackage?: { id: string; lessonsLeft: number; expiresAt: string | null } | null
  /**
   * The student has had their first lesson (the trial) with this teacher, so
   * lessons are booked from a package. Otherwise the only thing to book is the trial.
   */
  packageRequired?: boolean
}

function dateKeyLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function BookingForm({ teacher, activePackage = null, packageRequired = false }: BookingFormProps) {
  const { showToast } = useToast()
  const [subject, setSubject] = useState(teacher.subjects?.[0] || '')
  const [language, setLanguage] = useState(teacher.languages?.[0] || '')
  // Trial first, then lessons from a package: there are no single paid one-hour lessons.
  const trial = !packageRequired
  const canUsePackage = !!activePackage && activePackage.lessonsLeft > 0
  const durationMinutes = trial ? TRIAL.minutes : LESSON_MINUTES
  const [selectedStart, setSelectedStart] = useState<Date | null>(null)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([])
  const [bookings, setBookings] = useState<OccupyingBooking[]>([])
  const [loadingWeek, setLoadingWeek] = useState(true)
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

  // Shown in the browser with the default card-fee estimate; the server recomputes with the provider's own.
  const pricing = trialPrice()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedStart) {
      showToast('error', 'Please pick a time on the calendar.')
      return
    }

    setLoading(true)

    const response = await fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        teacherId: teacher.id,
        subject,
        language,
        startAt: selectedStart.toISOString(),
        // Without a package, the request is for the trial.
        ...(!trial && activePackage ? { packageId: activePackage.id } : {}),
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await response.json()
    setLoading(false)

    if (!response.ok) {
      showToast('error', result.error || 'Failed to create booking.')
      return
    }

    if (result.paidWithPackage) {
      showToast('success', 'Lesson requested. Your teacher will confirm it soon.')
      window.location.href = '/student/bookings'
      return
    }
    window.location.href = result.checkoutUrl
  }

  // Trial done and no lessons left in a package: the next step is choosing the package.
  if (!trial && !canUsePackage) {
    return (
      <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <Package className="h-5 w-5 text-emerald-600" aria-hidden="true" /> Continue with a package
        </h2>
        <p className="text-sm text-slate-600">
          You&apos;ve had your trial with this teacher. Lessons from now on are booked from a 10-lesson package. Choose it above, then book each lesson here.
        </p>
        <a href="#package" className="inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800">
          See the package
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-6">
      <h2 className="text-xl font-semibold text-slate-900">{trial ? 'Book your trial lesson' : 'Book a lesson'}</h2>
      <Select label="Subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} options={teacher.subjects.map((subject) => ({ value: subject, label: subject }))} required />
      <Select label="Language" name="language" value={language} onChange={(event) => setLanguage(event.target.value)} options={teacher.languages.map((language) => ({ value: language, label: language }))} required />
      <p className="text-sm text-slate-600">{trial ? `${TRIAL.minutes}-minute trial lesson` : 'One-hour lesson'}</p>

      {trial ? (
        <p className="flex items-start gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          <Gift className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" aria-hidden="true" />
          <span>
            <span className="block font-semibold">Your first lesson is a {TRIAL.minutes}-minute trial</span>
            Meet the teacher first. To continue afterwards, you&apos;ll choose a {PACKAGE.lessons}-lesson package.
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            <span className="block font-semibold">From your package</span>
            {activePackage!.lessonsLeft} lesson{activePackage!.lessonsLeft === 1 ? '' : 's'} left
            {activePackage!.expiresAt ? `, valid until ${new Date(activePackage!.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}. No payment needed.
          </span>
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
        {!trial ? (
          <p className="font-semibold text-slate-900">Paid with your package</p>
        ) : (
          <>
            <dl className="space-y-1 text-slate-600">
              <div className="flex justify-between">
                <dt>{TRIAL.minutes}-minute trial</dt>
                <dd>£{(pricing.studentPays - pricing.bookingFee).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Booking fee</dt>
                <dd>£{pricing.bookingFee.toFixed(2)}</dd>
              </div>
            </dl>
            <p className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
              <span>Total</span>
              <span>£{pricing.studentPays.toFixed(2)}</span>
            </p>
          </>
        )}
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">Pick a time</span>
        {loadingWeek ? (
          <div className="mb-2">
            <LoadingBlock inline label="Loading availability…" />
          </div>
        ) : null}
        <AvailabilityCalendar
          mode="booking"
          slots={slots}
          exceptions={exceptions}
          bookings={bookings}
          durationMinutes={durationMinutes}
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

      <Button type="submit" loading={loading} disabled={!selectedStart}>{loading ? 'Processing…' : trial ? 'Continue to payment' : 'Request this lesson'}</Button>
    </form>
  )
}
