import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAvailableStartTimes, getSlotStates, type AvailabilitySlot, type OccupyingBooking } from '../availability'

function slotForDate(date: Date, start: string, end: string): AvailabilitySlot {
  return { weekday: date.getDay(), start_time: start, end_time: end }
}

describe('getAvailableStartTimes — minNoticeHours', () => {
  beforeEach(() => {
    // Thursday 2026-08-13, 15:00 local time.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 13, 15, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to 0 (no minimum notice) and only excludes times already past today', () => {
    const today = new Date(2026, 7, 13)
    const slots = [slotForDate(today, '08:00', '20:00')]
    const times = getAvailableStartTimes(today, 60, slots, [], [])
    expect(times).not.toContain('14:00')
    expect(times).toContain('15:00')
  })

  it('blocks the entire current day when the notice window extends past it', () => {
    const today = new Date(2026, 7, 13)
    const slots = [slotForDate(today, '00:00', '23:59')]
    const times = getAvailableStartTimes(today, 60, slots, [], [], 24)
    expect(times).toEqual([])
  })

  it('on the cutoff day, only allows start times at/after now+minNoticeHours', () => {
    const cutoffDay = new Date(2026, 7, 14) // Friday — now (Thu 15:00) + 24h
    const slots = [slotForDate(cutoffDay, '00:00', '23:59')]
    const times = getAvailableStartTimes(cutoffDay, 60, slots, [], [], 24)
    expect(times).not.toContain('14:30')
    expect(times).toContain('15:00')
  })

  it('leaves days entirely after the cutoff day unaffected', () => {
    const dayAfter = new Date(2026, 7, 15) // Saturday
    const slots = [slotForDate(dayAfter, '08:00', '20:00')]
    const times = getAvailableStartTimes(dayAfter, 60, slots, [], [], 24)
    expect(times).toContain('08:00')
  })
})

describe('getSlotStates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 13, 15, 0, 0)) // Thursday 15:00
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('classifies a booked slot as unavailable even when it is outside the notice window', () => {
    const cutoffDay = new Date(2026, 7, 14) // Friday
    const slots = [slotForDate(cutoffDay, '00:00', '23:59')]
    const bookings: OccupyingBooking[] = [
      { start_at: new Date(2026, 7, 14, 16, 0).toISOString(), end_at: new Date(2026, 7, 14, 17, 0).toISOString(), status: 'confirmed' },
    ]
    const states = getSlotStates(cutoffDay, 60, slots, [], bookings, 24)
    const at16 = states.find((s) => s.start === 16 * 60)
    expect(at16?.state).toBe('unavailable')
  })

  it('classifies a free slot inside the notice window as too_soon, and outside it as bookable', () => {
    const cutoffDay = new Date(2026, 7, 14) // Friday, cutoff is 15:00
    const slots = [slotForDate(cutoffDay, '00:00', '23:59')]
    const states = getSlotStates(cutoffDay, 60, slots, [], [], 24)
    const at14 = states.find((s) => s.start === 14 * 60)
    const at16 = states.find((s) => s.start === 16 * 60)
    expect(at14?.state).toBe('too_soon')
    expect(at16?.state).toBe('bookable')
  })
})
