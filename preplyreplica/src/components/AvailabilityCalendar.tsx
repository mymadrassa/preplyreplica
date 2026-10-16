'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, LayoutGrid, Rows3 } from 'lucide-react'
import { WEEKDAY_LABELS, EXCEPTION_KINDS, type ExceptionKind } from '@/lib/constants'
import { getOpenRanges, getBookingsOnDate, getSlotStates, toMinutes, dateKey, type AvailabilitySlot, type AvailabilityException, type OccupyingBooking } from '@/lib/availability'
import { AvailabilityExceptionPopover } from '@/components/AvailabilityExceptionPopover'
import { BookingDetailModal } from '@/components/BookingDetailModal'

type Slot = AvailabilitySlot
// `id` is only present (and only needed) in 'owner' mode, to support editing
// an existing exception — the 'booking' mode's data source (the public
// availability API) omits it.
type Exception = AvailabilityException & { id?: string }
// `id`/`subject`/`profiles`/`teacher_confirmed_at` are only present (and only
// rendered) in 'owner' mode — the 'booking' mode's data source (the public
// availability API) deliberately omits them, since a student browsing a
// teacher's calendar shouldn't see who else booked what.
type Booking = OccupyingBooking & {
  id?: string
  subject?: string
  profiles?: { full_name: string | null; email: string | null } | null
  teacher_confirmed_at?: string | null
  is_trial?: boolean
}

const DISPLAY_START_HOUR = 6
const DISPLAY_END_HOUR = 23
const ROW_HEIGHT_PX = 48
const TOTAL_MINUTES = (DISPLAY_END_HOUR - DISPLAY_START_HOUR) * 60
const TOTAL_HEIGHT_PX = (DISPLAY_END_HOUR - DISPLAY_START_HOUR) * ROW_HEIGHT_PX

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

function startOfWeek(date: Date) {
  const monday = new Date(date)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return monday
}

function dayStatus(date: Date, slots: Slot[], exceptions: Exception[], bookings: Booking[], transientRejections: Record<string, Booking> = {}) {
  const key = dateKey(date)
  const dayExceptions = exceptions.filter((exception) => exception.exception_date === key)
  const blockedAllDay = dayExceptions.some((exception) => exception.kind !== 'available' && !exception.start_time)
  const availableRanges = getOpenRanges(date, slots, exceptions)
  // Real bookings only ever include non-terminal statuses here (see
  // NON_OCCUPYING_STATUSES) — a just-declined booking is layered back in
  // from client-only state so it stays visible as "Refused" for the rest of
  // this session, without ever suggesting the slot is still held.
  const transientToday = Object.values(transientRejections).filter((booking) => dateKey(new Date(booking.start_at)) === key)
  const bookingsToday = [...getBookingsOnDate(date, bookings), ...transientToday]

  return { availableRanges, blockedAllDay, bookingsToday, dayExceptions }
}

function snapTo30(minutes: number) {
  return Math.round(minutes / 30) * 30
}

function clampMinutes(minutes: number) {
  return Math.min(Math.max(minutes, 0), TOTAL_MINUTES)
}

interface AvailabilityCalendarProps {
  slots: Slot[]
  exceptions: Exception[]
  bookings: Booking[]
  /** 'owner' (default) is the teacher's own read-only-except-for-joining view. 'booking' is the
   * student-facing picker: it hides who booked what and turns open ranges into clickable start-time
   * slots for `durationMinutes`, gated by `minNoticeHours`. */
  mode?: 'owner' | 'booking'
  durationMinutes?: number
  selectedStart?: Date | null
  onSelectStart?: (date: Date) => void
  minNoticeHours?: number
  /** Fired whenever the visible week changes — 'booking' mode's caller uses this to fetch that week's data. */
  onVisibleWeekChange?: (weekStart: Date) => void
  /** Opens the calendar on this date's week instead of the current one — e.g. a "view in calendar" link jumping in from a specific booking. */
  initialDate?: Date
}

export function AvailabilityCalendar({
  slots,
  exceptions,
  bookings,
  mode = 'owner',
  durationMinutes = 60,
  selectedStart = null,
  onSelectStart,
  minNoticeHours = 0,
  onVisibleWeekChange,
  initialDate,
}: AvailabilityCalendarProps) {
  // Booking mode is always a week-at-a-time picker — a month grid can't show
  // per-slot availability, and the caller only ever fetches one week of data
  // at a time (see onVisibleWeekChange), so a month view would render mostly
  // blank.
  const router = useRouter()
  const [view, setView] = useState<'week' | 'month'>('week')
  const effectiveView = mode === 'booking' ? 'week' : view
  const [anchor, setAnchor] = useState(() => initialDate ?? new Date())
  const [now, setNow] = useState(() => new Date())
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  // Cursor-following tooltip used instead of native `title` in booking mode —
  // it tracks the mouse so it reads next to the pointer rather than wherever
  // the browser's own tooltip timing happens to place it.
  function trackTooltip(text: string) {
    return (event: React.MouseEvent) => setTooltip({ text, x: event.clientX, y: event.clientY })
  }
  function hideTooltip() {
    setTooltip(null)
  }

  // Owner-mode drag-to-create: minutes are tracked relative to the display
  // window (0 = DISPLAY_START_HOUR), matching `hoverMinutes`'s convention —
  // only converted to absolute minutes-since-midnight once a popover opens.
  const [drag, setDrag] = useState<{ date: Date; columnTop: number; startMinutes: number; currentMinutes: number } | null>(null)
  const [exceptionPopover, setExceptionPopover] = useState<{
    mode: 'create' | 'edit'
    exceptionId?: string
    date: Date
    startMinutes: number
    endMinutes: number
    kind: ExceptionKind
    position: { x: number; y: number }
  } | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  // Bookings just declined this session — kept visible as "Refused" until a
  // genuine page reload (this state resets on remount), independent of the
  // server-fetched `bookings` prop which, correctly, stops including them.
  const [transientRejections, setTransientRejections] = useState<Record<string, Booking>>({})

  function handleColumnMouseDown(event: React.MouseEvent<HTMLDivElement>, date: Date) {
    if (mode !== 'owner') return
    const rect = event.currentTarget.getBoundingClientRect()
    const minutes = snapTo30(clampMinutes(((event.clientY - rect.top) / TOTAL_HEIGHT_PX) * TOTAL_MINUTES))
    setDrag({ date, columnTop: rect.top, startMinutes: minutes, currentMinutes: minutes })
  }

  useEffect(() => {
    if (!drag) return

    function handleMouseMove(event: MouseEvent) {
      const minutes = snapTo30(clampMinutes(((event.clientY - drag!.columnTop) / TOTAL_HEIGHT_PX) * TOTAL_MINUTES))
      setDrag((current) => (current ? { ...current, currentMinutes: minutes } : current))
    }

    function handleMouseUp(event: MouseEvent) {
      setDrag((current) => {
        if (!current) return null
        const relativeStart = Math.min(current.startMinutes, current.currentMinutes)
        // A plain click (no meaningful drag) still creates a default 30-minute block.
        const relativeEnd = Math.min(Math.max(relativeStart + 30, Math.max(current.startMinutes, current.currentMinutes)), TOTAL_MINUTES)
        setExceptionPopover({
          mode: 'create',
          date: current.date,
          startMinutes: relativeStart + DISPLAY_START_HOUR * 60,
          endMinutes: relativeEnd + DISPLAY_START_HOUR * 60,
          kind: 'busy',
          position: { x: event.clientX, y: event.clientY },
        })
        return null
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag])

  function openEditPopover(exception: Exception, date: Date, event: React.MouseEvent) {
    if (!exception.id || !exception.start_time || !exception.end_time) return
    setExceptionPopover({
      mode: 'edit',
      exceptionId: exception.id,
      date,
      startMinutes: toMinutes(exception.start_time),
      endMinutes: toMinutes(exception.end_time),
      kind: exception.kind,
      position: { x: event.clientX, y: event.clientY },
    })
  }

  function handlePopoverSaved() {
    setExceptionPopover(null)
    router.refresh()
  }

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])

  useEffect(() => {
    onVisibleWeekChange?.(weekStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime()])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    return date
  }), [weekStart])

  const hours = Array.from({ length: DISPLAY_END_HOUR - DISPLAY_START_HOUR }, (_, i) => DISPLAY_START_HOUR + i)

  const monthGrid = useMemo(() => {
    if (effectiveView !== 'month') return []
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const gridStart = startOfWeek(firstOfMonth)
    return Array.from({ length: 6 }, (_, week) =>
      Array.from({ length: 7 }, (_, day) => {
        const date = new Date(gridStart)
        date.setDate(gridStart.getDate() + week * 7 + day)
        return date
      })
    )
  }, [effectiveView, anchor])

  function goToday() {
    setAnchor(new Date())
  }

  function goPrev() {
    setAnchor((current) => {
      const next = new Date(current)
      if (effectiveView === 'week') next.setDate(current.getDate() - 7)
      else next.setMonth(current.getMonth() - 1)
      return next
    })
  }

  function goNext() {
    setAnchor((current) => {
      const next = new Date(current)
      if (effectiveView === 'week') next.setDate(current.getDate() + 7)
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
    effectiveView === 'week'
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
        {mode === 'owner' ? (
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
        ) : null}
      </div>

      {mode === 'owner' && effectiveView === 'week' ? (
        <p className="mb-3 text-sm text-slate-500">Click or drag on the calendar to mark yourself busy, on vacation, or add extra availability.</p>
      ) : null}

      {effectiveView === 'week' ? (
        <div className={`overflow-x-auto ${mode === 'booking' ? 'max-h-[30rem] overflow-y-auto rounded-2xl border border-slate-200' : ''} ${drag ? 'select-none' : ''}`}>
          <div className="grid min-w-[720px] grid-cols-[4rem_repeat(7,1fr)]">
            <div className="sticky top-0 z-20 bg-white" />
            {weekDays.map((date) => (
              <div
                key={date.toISOString()}
                className={`sticky top-0 z-20 border-b border-slate-200 px-2 py-3 text-center ${dateKey(date) === dateKey(now) ? 'bg-brand-50' : 'bg-white'}`}
              >
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
              const { availableRanges, blockedAllDay, bookingsToday, dayExceptions } = dayStatus(date, slots, exceptions, bookings, transientRejections)

              return (
                <div
                  key={dateKey(date)}
                  className={`relative border-l border-slate-100 first:border-l-0 ${mode === 'owner' ? 'cursor-crosshair' : ''}`}
                  style={{ height: TOTAL_HEIGHT_PX }}
                  onMouseMove={handleGridMouseMove}
                  onMouseLeave={() => setHoverMinutes(null)}
                  onMouseDown={(event) => handleColumnMouseDown(event, date)}
                >
                  {hours.map((hour) => (
                    <div key={hour} className="absolute inset-x-0 border-t border-slate-100" style={{ top: minutesToPx((hour - DISPLAY_START_HOUR) * 60) }} />
                  ))}

                  {blockedAllDay ? (
                    mode === 'booking' ? (
                      <div
                        className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#fde68a,#fde68a_6px,#fef3c7_6px,#fef3c7_12px)]"
                        onMouseEnter={trackTooltip('Not available this day')}
                        onMouseMove={trackTooltip('Not available this day')}
                        onMouseLeave={hideTooltip}
                      />
                    ) : (
                      <div
                        className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_6px,#f1f5f9_6px,#f1f5f9_12px)]"
                        onMouseEnter={trackTooltip('Blocked — you marked this day unavailable')}
                        onMouseMove={trackTooltip('Blocked — you marked this day unavailable')}
                        onMouseLeave={hideTooltip}
                      />
                    )
                  ) : mode === 'booking' ? (
                    getSlotStates(date, durationMinutes, slots, exceptions, bookings, minNoticeHours).map(({ start, state }) => {
                      const top = minutesToPx(start - DISPLAY_START_HOUR * 60)
                      const height = minutesToPx(durationMinutes)

                      if (state === 'unavailable') {
                        return (
                          <div
                            key={start}
                            className="absolute inset-x-0.5 rounded-md bg-slate-400 ring-1 ring-inset ring-slate-500"
                            style={{ top, height }}
                            onMouseEnter={trackTooltip('Already booked')}
                            onMouseMove={trackTooltip('Already booked')}
                            onMouseLeave={hideTooltip}
                          />
                        )
                      }

                      if (state === 'too_soon') {
                        const text = `Too soon to book — sessions must be booked at least ${minNoticeHours} hours in advance.`
                        return (
                          <div
                            key={start}
                            className="absolute inset-x-0.5 cursor-not-allowed rounded-md bg-[repeating-linear-gradient(45deg,#fde68a,#fde68a_6px,#fef3c7_6px,#fef3c7_12px)] ring-1 ring-inset ring-amber-400"
                            style={{ top, height }}
                            onMouseEnter={trackTooltip(text)}
                            onMouseMove={trackTooltip(text)}
                            onMouseLeave={hideTooltip}
                          />
                        )
                      }

                      const isSelected =
                        !!selectedStart &&
                        dateKey(date) === dateKey(selectedStart) &&
                        start === selectedStart.getHours() * 60 + selectedStart.getMinutes()

                      return (
                        <button
                          key={start}
                          type="button"
                          onClick={() => {
                            const selected = new Date(date)
                            selected.setHours(Math.floor(start / 60), start % 60, 0, 0)
                            onSelectStart?.(selected)
                          }}
                          onMouseEnter={trackTooltip(isSelected ? 'Selected' : 'Available — click to select this time')}
                          onMouseMove={trackTooltip(isSelected ? 'Selected' : 'Available — click to select this time')}
                          onMouseLeave={hideTooltip}
                          className={`absolute inset-x-0.5 cursor-pointer rounded-md transition-colors ${
                            isSelected
                              ? 'bg-brand-600 ring-2 ring-inset ring-brand-700'
                              : 'bg-emerald-400 ring-1 ring-inset ring-emerald-600 hover:bg-emerald-500'
                          }`}
                          style={{ top, height }}
                        />
                      )
                    })
                  ) : (
                    <>
                      {availableRanges.map(([start, end], i) => (
                        <div
                          key={i}
                          className="absolute inset-x-0.5 rounded-md bg-emerald-200 ring-1 ring-inset ring-emerald-400"
                          style={{ top: minutesToPx(start - DISPLAY_START_HOUR * 60), height: minutesToPx(end - start) }}
                          onMouseEnter={trackTooltip('Weekly availability')}
                          onMouseMove={trackTooltip('Weekly availability')}
                          onMouseLeave={hideTooltip}
                        />
                      ))}
                      {dayExceptions
                        .filter((exception) => exception.start_time && exception.end_time)
                        .map((exception, i) => {
                          const excStart = toMinutes(exception.start_time!)
                          const excEnd = toMinutes(exception.end_time!)
                          const kindConfig = EXCEPTION_KINDS.find((k) => k.value === exception.kind)
                          const tooltipText = `${kindConfig?.label ?? exception.kind} — click to edit`
                          return (
                            <div
                              key={exception.id ?? `exc-${i}`}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => openEditPopover(exception, date, event)}
                              onMouseEnter={trackTooltip(tooltipText)}
                              onMouseMove={trackTooltip(tooltipText)}
                              onMouseLeave={hideTooltip}
                              className="absolute inset-x-0.5 cursor-pointer rounded-md transition-opacity hover:opacity-80"
                              style={{
                                top: minutesToPx(excStart - DISPLAY_START_HOUR * 60),
                                height: minutesToPx(excEnd - excStart),
                                backgroundColor: kindConfig?.bg,
                                boxShadow: `inset 0 0 0 1px ${kindConfig?.ring}`,
                              }}
                            />
                          )
                        })}
                    </>
                  )}

                  {drag && dateKey(drag.date) === dateKey(date) ? (
                    <div
                      className="pointer-events-none absolute inset-x-0.5 rounded-md bg-slate-500/40 ring-2 ring-dashed ring-slate-500"
                      style={{
                        top: minutesToPx(Math.min(drag.startMinutes, drag.currentMinutes)),
                        height: Math.max(minutesToPx(Math.abs(drag.currentMinutes - drag.startMinutes)), 4),
                      }}
                    />
                  ) : null}

                  {exceptionPopover && dateKey(exceptionPopover.date) === dateKey(date) ? (
                    <div
                      className="pointer-events-none absolute inset-x-0.5 rounded-md"
                      style={{
                        top: minutesToPx(exceptionPopover.startMinutes - DISPLAY_START_HOUR * 60),
                        height: minutesToPx(exceptionPopover.endMinutes - exceptionPopover.startMinutes),
                        backgroundColor: EXCEPTION_KINDS.find((k) => k.value === exceptionPopover.kind)?.bg,
                        boxShadow: `inset 0 0 0 2px ${EXCEPTION_KINDS.find((k) => k.value === exceptionPopover.kind)?.ring}`,
                      }}
                    />
                  ) : null}

                  {mode === 'owner' &&
                    bookingsToday.map((booking) => {
                      const start = new Date(booking.start_at)
                      const end = new Date(booking.end_at)
                      const startMinutes = start.getHours() * 60 + start.getMinutes() - DISPLAY_START_HOUR * 60
                      const endMinutes = end.getHours() * 60 + end.getMinutes() - DISPLAY_START_HOUR * 60
                      const studentName = booking.profiles?.full_name || booking.profiles?.email || 'Student'
                      const style = { top: minutesToPx(startMinutes), height: Math.max(minutesToPx(endMinutes - startMinutes), 20) }

                      // Every booking (whatever its status) opens the same
                      // detail view on click — only the color and label here
                      // change, to make the calendar scannable at a glance.
                      let colorClass = 'bg-brand-600 text-white hover:bg-brand-700'
                      let label = `${booking.subject} · ${studentName}`
                      let tooltip = `${booking.subject} with ${studentName} — click for details`

                      if (booking.status === 'pending') {
                        colorClass = 'border-2 border-dashed border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200'
                        label = `Needs review · ${booking.subject} · ${studentName}`
                        tooltip = `Needs review: ${booking.subject} with ${studentName} — click to approve or decline`
                      } else if (booking.status === 'pending_payment') {
                        colorClass = 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                        tooltip = `${booking.subject} with ${studentName} — payment still processing`
                      } else if (booking.status === 'confirmed' && end <= now) {
                        colorClass = 'border-2 border-dashed border-indigo-400 bg-indigo-100 text-indigo-900 hover:bg-indigo-200'
                        label = `${booking.teacher_confirmed_at ? 'Awaiting payout' : 'Confirm completed'} · ${booking.subject} · ${studentName}`
                        tooltip = booking.teacher_confirmed_at
                          ? `${booking.subject} with ${studentName} — awaiting admin confirmation for payout`
                          : `Session ended: ${booking.subject} with ${studentName} — click to confirm it happened`
                      } else if (booking.status === 'rejected') {
                        // Just declined this session — the real data no longer
                        // holds this slot (a student could already rebook it),
                        // this is purely a temporary "yes, that went through"
                        // confirmation that clears on the next page load.
                        colorClass = 'border border-dashed border-red-300 bg-red-50 text-red-700 line-through decoration-red-300 hover:bg-red-100'
                        label = `Refused · ${booking.subject} · ${studentName}`
                        tooltip = `Declined: ${booking.subject} with ${studentName}`
                      }

                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={() => setSelectedBooking(booking)}
                          onMouseEnter={trackTooltip(tooltip)}
                          onMouseMove={trackTooltip(tooltip)}
                          onMouseLeave={hideTooltip}
                          className={`absolute inset-x-0.5 cursor-pointer overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition-colors ${colorClass}`}
                          style={style}
                        >
                          <span className="line-clamp-2 font-medium">{label}</span>
                        </button>
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

      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 max-w-[16rem] rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          {tooltip.text}
        </div>
      ) : null}

      {mode === 'owner' && exceptionPopover ? (
        <AvailabilityExceptionPopover
          mode={exceptionPopover.mode}
          exceptionId={exceptionPopover.exceptionId}
          date={exceptionPopover.date}
          startMinutes={exceptionPopover.startMinutes}
          endMinutes={exceptionPopover.endMinutes}
          kind={exceptionPopover.kind}
          position={exceptionPopover.position}
          onClose={() => setExceptionPopover(null)}
          onSaved={handlePopoverSaved}
          onPreviewChange={(startMinutes, endMinutes, kind) =>
            setExceptionPopover((current) => (current ? { ...current, startMinutes, endMinutes, kind } : current))
          }
        />
      ) : null}

      {mode === 'owner' && selectedBooking && selectedBooking.id ? (
        <BookingDetailModal
          bookingId={selectedBooking.id}
          subject={selectedBooking.subject ?? 'Lesson'}
          studentName={selectedBooking.profiles?.full_name || selectedBooking.profiles?.email || 'Student'}
          startAt={selectedBooking.start_at}
          endAt={selectedBooking.end_at}
          status={selectedBooking.status}
          teacherConfirmedAt={selectedBooking.teacher_confirmed_at ?? null}
          isTrial={selectedBooking.is_trial}
          onClose={() => setSelectedBooking(null)}
          onActionSuccess={(action) => {
            if (action === 'reject' && selectedBooking.id) {
              const rejectedBooking = { ...selectedBooking, status: 'rejected' }
              setTransientRejections((current) => ({ ...current, [selectedBooking.id as string]: rejectedBooking }))
            }
          }}
        />
      ) : null}
    </div>
  )
}

const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
