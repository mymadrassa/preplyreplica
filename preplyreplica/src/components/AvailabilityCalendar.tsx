'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, LayoutGrid, Rows3 } from 'lucide-react'
import { WEEKDAY_LABELS } from '@/lib/constants'

type Slot = { weekday: number; start_time: string; end_time: string }
type Exception = { exception_date: string; start_time: string | null; end_time: string | null; exception_type: 'blocked' | 'added' }
type Booking = {
  id: string
  start_at: string
  end_at: string
  subject: string
  status: string
  profiles: { full_name: string | null; email: string | null } | null
}

const DISPLAY_START_HOUR = 6
const DISPLAY_END_HOUR = 23
const ROW_HEIGHT_PX = 48
const TOTAL_MINUTES = (DISPLAY_END_HOUR - DISPLAY_START_HOUR) * 60
const TOTAL_HEIGHT_PX = (DISPLAY_END_HOUR - DISPLAY_START_HOUR) * ROW_HEIGHT_PX
const CANCELLED_STATUSES = new Set(['cancelled', 'rejected'])

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function overlaps(rangeStart: number, rangeEnd: number, blockStart: number, blockEnd: number) {
  return rangeStart < blockEnd && rangeEnd > blockStart
}

function minutesToPx(minutesSinceStart: number) {
  return (minutesSinceStart / TOTAL_MINUTES) * TOTAL_HEIGHT_PX
}

function formatTime(minutesSinceMidnight: number) {
  const hours24 = Math.floor(minutesSinceMidnight / 60)
  const minutes = Math.round(minutesSinceMidnight % 60)
  const period = hours24 < 12 ? 'AM' : 'PM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function startOfWeek(date: Date) {
  const monday = new Date(date)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return monday
}

function dayStatus(date: Date, slots: Slot[], exceptions: Exception[], bookings: Booking[]) {
  const key = dateKey(date)
  const weekday = date.getDay()
  const dayException = exceptions.find((exception) => exception.exception_date === key)
  const blockedAllDay = dayException?.exception_type === 'blocked' && !dayException.start_time

  let availableRanges: [number, number][] = []
  if (!blockedAllDay) {
    if (dayException?.exception_type === 'added' && dayException.start_time && dayException.end_time) {
      availableRanges = [[toMinutes(dayException.start_time), toMinutes(dayException.end_time)]]
    } else {
      availableRanges = slots
        .filter((slot) => slot.weekday === weekday)
        .map((slot): [number, number] => [toMinutes(slot.start_time), toMinutes(slot.end_time)])
      if (dayException?.exception_type === 'blocked' && dayException.start_time && dayException.end_time) {
        const blockStart = toMinutes(dayException.start_time)
        const blockEnd = toMinutes(dayException.end_time)
        availableRanges = availableRanges.filter(([start, end]) => !overlaps(start, end, blockStart, blockEnd))
      }
    }
  }

  const bookingsToday = bookings.filter((b) => !CANCELLED_STATUSES.has(b.status) && dateKey(new Date(b.start_at)) === key)

  return { availableRanges, blockedAllDay, bookingsToday }
}

export function AvailabilityCalendar({ slots, exceptions, bookings }: { slots: Slot[]; exceptions: Exception[]; bookings: Booking[] }) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [now, setNow] = useState(() => new Date())
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    return date
  }), [weekStart])

  const hours = Array.from({ length: DISPLAY_END_HOUR - DISPLAY_START_HOUR }, (_, i) => DISPLAY_START_HOUR + i)

  const monthGrid = useMemo(() => {
    if (view !== 'month') return []
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const gridStart = startOfWeek(firstOfMonth)
    return Array.from({ length: 6 }, (_, week) =>
      Array.from({ length: 7 }, (_, day) => {
        const date = new Date(gridStart)
        date.setDate(gridStart.getDate() + week * 7 + day)
        return date
      })
    )
  }, [view, anchor])

  function goToday() {
    setAnchor(new Date())
  }

  function goPrev() {
    setAnchor((current) => {
      const next = new Date(current)
      if (view === 'week') next.setDate(current.getDate() - 7)
      else next.setMonth(current.getMonth() - 1)
      return next
    })
  }

  function goNext() {
    setAnchor((current) => {
      const next = new Date(current)
      if (view === 'week') next.setDate(current.getDate() + 7)
      else next.setMonth(current.getMonth() + 1)
      return next
    })
  }

  function handleGridMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - rect.top
    const minutesSinceStart = (y / TOTAL_HEIGHT_PX) * TOTAL_MINUTES
    setHoverMinutes(Math.min(Math.max(minutesSinceStart, 0), TOTAL_MINUTES))
  }

  const rangeLabel =
    view === 'week'
      ? `${weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const nowMinutesSinceStart = (now.getHours() * 60 + now.getMinutes()) - DISPLAY_START_HOUR * 60
  const showNowLine = nowMinutesSinceStart >= 0 && nowMinutesSinceStart <= TOTAL_MINUTES

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goPrev} aria-label="Previous" className="cursor-pointer rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={goToday} className="cursor-pointer rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Today
          </button>
          <button type="button" onClick={goNext} aria-label="Next" className="cursor-pointer rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="ml-2 text-sm font-semibold text-slate-900">{rangeLabel}</p>
        </div>
        <div className="flex rounded-full border border-slate-200 p-1">
          <button
            type="button"
            onClick={() => setView('week')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${view === 'week' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Rows3 className="h-3.5 w-3.5" aria-hidden="true" /> Week
          </button>
          <button
            type="button"
            onClick={() => setView('month')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${view === 'month' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /> Month
          </button>
        </div>
      </div>

      {view === 'week' ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-[4rem_repeat(7,1fr)]">
            <div />
            {weekDays.map((date) => (
              <div key={date.toISOString()} className={`border-b border-slate-200 px-2 py-3 text-center ${dateKey(date) === dateKey(now) ? 'bg-brand-50' : ''}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{WEEKDAY_LABELS[date.getDay()].slice(0, 3)}</p>
                <p className="text-sm font-semibold text-slate-900">{date.getDate()}</p>
              </div>
            ))}

            <div className="relative" style={{ height: TOTAL_HEIGHT_PX }}>
              {hours.map((hour) => (
                <div key={hour} className="absolute inset-x-0 -translate-y-1/2 text-right text-xs text-slate-400" style={{ top: minutesToPx((hour - DISPLAY_START_HOUR) * 60) }}>
                  {hour % 12 === 0 ? 12 : hour % 12}{hour < 12 ? 'am' : 'pm'}
                </div>
              ))}
              {hoverMinutes !== null ? (
                <div className="absolute inset-x-0 -translate-y-1/2 text-right text-xs font-semibold text-brand-600" style={{ top: minutesToPx(hoverMinutes) }}>
                  {formatTime(hoverMinutes + DISPLAY_START_HOUR * 60)}
                </div>
              ) : null}
            </div>

            {weekDays.map((date) => {
              const isToday = dateKey(date) === dateKey(now)
              const { availableRanges, blockedAllDay, bookingsToday } = dayStatus(date, slots, exceptions, bookings)

              return (
                <div
                  key={dateKey(date)}
                  className="relative border-l border-slate-100 first:border-l-0"
                  style={{ height: TOTAL_HEIGHT_PX }}
                  onMouseMove={handleGridMouseMove}
                  onMouseLeave={() => setHoverMinutes(null)}
                >
                  {hours.map((hour) => (
                    <div key={hour} className="absolute inset-x-0 border-t border-slate-100" style={{ top: minutesToPx((hour - DISPLAY_START_HOUR) * 60) }} />
                  ))}

                  {blockedAllDay ? (
                    <div
                      className="absolute inset-0 cursor-help bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_6px,#f1f5f9_6px,#f1f5f9_12px)]"
                      title="Blocked — you marked this day unavailable"
                    />
                  ) : (
                    availableRanges.map(([start, end], i) => (
                      <div
                        key={i}
                        className="absolute inset-x-0.5 cursor-help rounded-md bg-emerald-200 ring-1 ring-inset ring-emerald-400"
                        style={{ top: minutesToPx(start - DISPLAY_START_HOUR * 60), height: minutesToPx(end - start) }}
                        title="Available for booking"
                      />
                    ))
                  )}

                  {bookingsToday.map((booking) => {
                    const start = new Date(booking.start_at)
                    const end = new Date(booking.end_at)
                    const startMinutes = start.getHours() * 60 + start.getMinutes() - DISPLAY_START_HOUR * 60
                    const endMinutes = end.getHours() * 60 + end.getMinutes() - DISPLAY_START_HOUR * 60
                    const studentName = booking.profiles?.full_name || booking.profiles?.email || 'Student'
                    return (
                      <Link
                        key={booking.id}
                        href={`/session/${booking.id}`}
                        title={`Join session: ${booking.subject} with ${studentName} — click to open`}
                        className="absolute inset-x-0.5 cursor-pointer overflow-hidden rounded-md bg-brand-600 px-1.5 py-1 text-[11px] leading-tight text-white shadow-sm transition-colors hover:bg-brand-700"
                        style={{ top: minutesToPx(startMinutes), height: Math.max(minutesToPx(endMinutes - startMinutes), 20) }}
                      >
                        <span className="line-clamp-2 font-medium">{booking.subject} · {studentName}</span>
                      </Link>
                    )
                  })}

                  {isToday && showNowLine ? (
                    <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: minutesToPx(nowMinutesSinceStart) }}>
                      <span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-red-500" />
                    </div>
                  ) : null}

                  {hoverMinutes !== null ? (
                    <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-400" style={{ top: minutesToPx(hoverMinutes) }} />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200">
          {WEEKDAYS_SHORT.map((label) => (
            <div key={label} className="bg-white px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              {label}
            </div>
          ))}
          {monthGrid.flat().map((date) => {
            const inCurrentMonth = date.getMonth() === anchor.getMonth()
            const { availableRanges, blockedAllDay, bookingsToday } = dayStatus(date, slots, exceptions, bookings)
            const hasAvailability = availableRanges.length > 0
            const isToday = dateKey(date) === dateKey(now)

            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => {
                  setAnchor(date)
                  setView('week')
                }}
                title={
                  bookingsToday.length
                    ? `${bookingsToday.length} booked session${bookingsToday.length > 1 ? 's' : ''}`
                    : hasAvailability
                    ? 'Available for booking'
                    : blockedAllDay
                    ? 'Blocked — you marked this day unavailable'
                    : 'No availability set'
                }
                className={`flex min-h-[5rem] cursor-pointer flex-col items-start gap-1 p-2 text-left transition-colors hover:bg-brand-50 ${
                  inCurrentMonth ? 'bg-white' : 'bg-slate-50 text-slate-400'
                }`}
              >
                <span className={`text-sm font-semibold ${isToday ? 'flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white' : ''}`}>
                  {date.getDate()}
                </span>
                <div className="flex flex-wrap gap-1">
                  {bookingsToday.length ? (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {bookingsToday.length} booked
                    </span>
                  ) : null}
                  {hasAvailability ? <span className="h-2 w-2 rounded-full bg-emerald-400" /> : null}
                  {blockedAllDay ? <span className="h-2 w-2 rounded-full bg-slate-400" /> : null}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-200 ring-1 ring-inset ring-emerald-400" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand-600" /> Booked session (click to join)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_6px,#f1f5f9_6px,#f1f5f9_12px)] ring-1 ring-inset ring-slate-300" /> Blocked</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-red-500" /> Current time</span>
      </div>
    </div>
  )
}

const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
