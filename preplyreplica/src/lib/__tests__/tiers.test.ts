import { describe, expect, it } from 'vitest'
import { monthsBetween, nextTierFor, nextTierProgress, statsFromBookings, tierFor, type TeacherStats } from '../tiers'

const newTeacher: TeacherStats = { monthsActive: 0, completedLessons: 0, ratingAvg: 0, cancelRate: 0, retention: 0 }
const mid: TeacherStats = { monthsActive: 3, completedLessons: 40, ratingAvg: 4.7, cancelRate: 0.05, retention: 0.3 }
const top: TeacherStats = { monthsActive: 6, completedLessons: 100, ratingAvg: 4.8, cancelRate: 0.05, retention: 0.6 }

describe('tierFor', () => {
  it('starts everyone at Starter', () => {
    expect(tierFor(newTeacher)).toBe('starter')
  })

  it('reaches Mid and Top once every criterion is met', () => {
    expect(tierFor(mid)).toBe('mid')
    expect(tierFor(top)).toBe('top')
  })

  it.each([
    ['months', { monthsActive: 2 }],
    ['lessons', { completedLessons: 39 }],
    ['rating', { ratingAvg: 4.6 }],
    ['cancellations', { cancelRate: 0.2 }],
  ])('stays Starter when %s fall short of Mid', (_, change) => {
    expect(tierFor({ ...mid, ...change })).toBe('starter')
  })

  it('needs retention for Top', () => {
    expect(tierFor({ ...top, retention: 0.4 })).toBe('mid')
  })
})

describe('nextTierFor', () => {
  it('promotes but never demotes', () => {
    expect(nextTierFor('starter', mid, false)).toBe('mid')
    expect(nextTierFor('top', newTeacher, false)).toBe('top')
  })

  it('keeps an admin-set tier', () => {
    expect(nextTierFor('starter', top, true)).toBe('starter')
  })
})

describe('nextTierProgress', () => {
  it('lists what is missing for the next tier', () => {
    const progress = nextTierProgress('starter', { ...mid, completedLessons: 28, monthsActive: 2 })
    expect(progress?.next).toBe('mid')
    expect(progress?.ratio).toBeCloseTo(0.7)
    expect(progress?.missing).toEqual(['12 more lessons', '1 more month on the platform'])
  })

  it('has nothing above Top', () => {
    expect(nextTierProgress('top', top)).toBeNull()
  })
})

describe('statsFromBookings', () => {
  it('counts lessons, declines and returning students', () => {
    const stats = statsFromBookings(
      [
        { student_id: 'a', status: 'completed' },
        { student_id: 'a', status: 'completed' },
        { student_id: 'b', status: 'completed' },
        { student_id: 'c', status: 'rejected' },
        { student_id: 'd', status: 'pending_payment' },
      ],
      { approvedAt: '2026-01-15T00:00:00Z', ratingAvg: 4.9, now: new Date('2026-04-20T00:00:00Z') }
    )
    expect(stats).toEqual({ monthsActive: 3, completedLessons: 3, ratingAvg: 4.9, cancelRate: 0.25, retention: 0.5 })
  })

  it('counts whole months only', () => {
    expect(monthsBetween(new Date('2026-01-20'), new Date('2026-04-19'))).toBe(2)
  })
})
