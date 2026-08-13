// Single source of truth for "is this teacher free at this time" — used by
// the teacher's own calendar view, the student-facing slot picker, and the
// server-side re-validation at booking time. Keeping one implementation
// means those three surfaces can't silently drift out of sync.

export type AvailabilitySlot = { weekday: number; start_time: string; end_time: string }
export type AvailabilityException = {
  exception_date: string
  start_time: string | null
  end_time: string | null
  exception_type: 'blocked' | 'added'
}
export type OccupyingBooking = { start_at: string; end_at: string; status: string }

// Bookings in any of these statuses hold their slot open against other
// bookings; only cancelled/rejected ones free it back up.
const NON_OCCUPYING_STATUSES = new Set(['cancelled', 'rejected'])

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function overlaps(rangeStart: number, rangeEnd: number, blockStart: number, blockEnd: number) {
  return rangeStart < blockEnd && rangeEnd > blockStart
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** The teacher's theoretically open windows for a given date (weekly slots, adjusted by that date's exceptions) — before considering existing bookings. */
export function getOpenRanges(date: Date, slots: AvailabilitySlot[], exceptions: AvailabilityException[]): [number, number][] {
  const key = dateKey(date)
  const weekday = date.getDay()
  const dayException = exceptions.find((exception) => exception.exception_date === key)
  const blockedAllDay = dayException?.exception_type === 'blocked' && !dayException.start_time
  if (blockedAllDay) return []

  if (dayException?.exception_type === 'added' && dayException.start_time && dayException.end_time) {
    return [[toMinutes(dayException.start_time), toMinutes(dayException.end_time)]]
  }

  let ranges = slots
    .filter((slot) => slot.weekday === weekday)
    .map((slot): [number, number] => [toMinutes(slot.start_time), toMinutes(slot.end_time)])

  if (dayException?.exception_type === 'blocked' && dayException.start_time && dayException.end_time) {
    const blockStart = toMinutes(dayException.start_time)
    const blockEnd = toMinutes(dayException.end_time)
    ranges = ranges.filter(([start, end]) => !overlaps(start, end, blockStart, blockEnd))
  }

  return ranges
}

/** Bookings that occupy a given date (in local time), excluding cancelled/rejected ones. */
export function getBookingsOnDate<T extends OccupyingBooking>(date: Date, bookings: T[]): T[] {
  const key = dateKey(date)
  return bookings.filter((b) => !NON_OCCUPYING_STATUSES.has(b.status) && dateKey(new Date(b.start_at)) === key)
}

/** Whether [start, end) (minutes since midnight) is free: inside an open range and clear of existing bookings. */
export function isRangeFree(
  date: Date,
  startMinutes: number,
  endMinutes: number,
  slots: AvailabilitySlot[],
  exceptions: AvailabilityException[],
  bookings: OccupyingBooking[]
) {
  const openRanges = getOpenRanges(date, slots, exceptions)
  const fitsAnOpenRange = openRanges.some(([open, close]) => startMinutes >= open && endMinutes <= close)
  if (!fitsAnOpenRange) return false

  const dayBookings = getBookingsOnDate(date, bookings)
  const conflicts = dayBookings.some((b) => {
    const bStart = new Date(b.start_at)
    const bEnd = new Date(b.end_at)
    const bStartMinutes = bStart.getHours() * 60 + bStart.getMinutes()
    const bEndMinutes = bEnd.getHours() * 60 + bEnd.getMinutes()
    return overlaps(startMinutes, endMinutes, bStartMinutes, bEndMinutes)
  })
  return !conflicts
}

/**
 * Valid booking start times (as "HH:MM") for a given date + duration, stepped every
 * 30 min, excluding times already in the past and — when `minNoticeHours` is set —
 * times closer than that to now (e.g. the 24h minimum booking notice). The cutoff is
 * computed as `now + minNoticeHours` and compared by date, so a notice window that
 * spills into the next calendar day correctly blocks the start of that day too, not
 * just "today."
 */
export function getAvailableStartTimes(
  date: Date,
  durationMinutes: number,
  slots: AvailabilitySlot[],
  exceptions: AvailabilityException[],
  bookings: OccupyingBooking[],
  minNoticeHours = 0
): string[] {
  const openRanges = getOpenRanges(date, slots, exceptions)
  if (!openRanges.length) return []

  const cutoff = new Date(Date.now() + minNoticeHours * 60 * 60 * 1000)
  const dateIsBeforeCutoffDay = dateKey(date) < dateKey(cutoff)
  if (dateIsBeforeCutoffDay) return []

  const dateIsCutoffDay = dateKey(date) === dateKey(cutoff)
  const earliestMinutes = dateIsCutoffDay ? cutoff.getHours() * 60 + cutoff.getMinutes() : 0

  const candidates = new Set<number>()
  for (const [open, close] of openRanges) {
    for (let start = Math.ceil(Math.max(open, earliestMinutes) / 30) * 30; start + durationMinutes <= close; start += 30) {
      candidates.add(start)
    }
  }

  return Array.from(candidates)
    .filter((start) => isRangeFree(date, start, start + durationMinutes, slots, exceptions, bookings))
    .sort((a, b) => a - b)
    .map((start) => `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`)
}

export type SlotState = 'bookable' | 'too_soon' | 'unavailable'

/**
 * Like `getAvailableStartTimes`, but classifies every candidate start time
 * (minutes since midnight) instead of only returning the bookable ones —
 * used by the student booking calendar to render three distinct states
 * (openly bookable / open but inside the notice window / already taken)
 * rather than collapsing "too soon" and "taken" into the same non-clickable
 * appearance.
 */
export function getSlotStates(
  date: Date,
  durationMinutes: number,
  slots: AvailabilitySlot[],
  exceptions: AvailabilityException[],
  bookings: OccupyingBooking[],
  minNoticeHours = 0
): { start: number; state: SlotState }[] {
  const openRanges = getOpenRanges(date, slots, exceptions)
  if (!openRanges.length) return []

  const cutoff = new Date(Date.now() + minNoticeHours * 60 * 60 * 1000).getTime()

  const candidates = new Set<number>()
  for (const [open, close] of openRanges) {
    for (let start = Math.ceil(open / 30) * 30; start + durationMinutes <= close; start += 30) {
      candidates.add(start)
    }
  }

  return Array.from(candidates)
    .sort((a, b) => a - b)
    .map((start) => {
      if (!isRangeFree(date, start, start + durationMinutes, slots, exceptions, bookings)) {
        return { start, state: 'unavailable' as const }
      }
      const slotStart = new Date(date)
      slotStart.setHours(Math.floor(start / 60), start % 60, 0, 0)
      return { start, state: (slotStart.getTime() < cutoff ? 'too_soon' : 'bookable') as SlotState }
    })
}
