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

/** Valid booking start times (as "HH:MM") for a given date + duration, stepped every 30 min, excluding times already in the past. */
export function getAvailableStartTimes(
  date: Date,
  durationMinutes: number,
  slots: AvailabilitySlot[],
  exceptions: AvailabilityException[],
  bookings: OccupyingBooking[]
): string[] {
  const openRanges = getOpenRanges(date, slots, exceptions)
  if (!openRanges.length) return []

  const now = new Date()
  const isToday = dateKey(date) === dateKey(now)
  const earliestMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0

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
