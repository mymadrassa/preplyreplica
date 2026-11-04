import { describe, expect, it } from 'vitest'
import { formatRate, summarizeFollowUp } from '../homeworkFollowUp'

const lessons = [
  { id: 'l1', start_at: '2026-10-01T10:00:00Z' },
  { id: 'l2', start_at: '2026-10-08T10:00:00Z' },
  { id: 'l3', start_at: '2026-10-15T10:00:00Z' },
]
const now = new Date('2026-10-20T00:00:00Z')

describe('summarizeFollowUp', () => {
  it('counts lessons, homework and completion', () => {
    const summary = summarizeFollowUp(
      lessons,
      [
        { booking_id: 'l1', done_at: '2026-10-05T00:00:00Z', teacher_seen_done_at: '2026-10-06T00:00:00Z' },
        { booking_id: 'l2', done_at: null, teacher_seen_done_at: null },
      ],
      now
    )
    expect(summary).toMatchObject({ lessons: 3, lastLessonAt: '2026-10-15T10:00:00Z', given: 2, done: 1, open: 1, completionRate: 0.5, unseenDone: 0 })
  })

  it('judges on time against the next lesson', () => {
    const summary = summarizeFollowUp(
      lessons,
      [
        // done before lesson 2: on time
        { booking_id: 'l1', done_at: '2026-10-07T00:00:00Z', teacher_seen_done_at: null },
        // done after lesson 3: late
        { booking_id: 'l2', done_at: '2026-10-16T00:00:00Z', teacher_seen_done_at: null },
        // latest lesson, still open: no deadline yet, not judged
        { booking_id: 'l3', done_at: null, teacher_seen_done_at: null },
      ],
      now
    )
    expect(summary.onTimeRate).toBe(0.5)
    expect(summary.unseenDone).toBe(2)
  })

  it('counts open homework past its deadline as late', () => {
    const summary = summarizeFollowUp(lessons, [{ booking_id: 'l1', done_at: null, teacher_seen_done_at: null }], now)
    expect(summary.onTimeRate).toBe(0)
  })

  it('has no rates without homework', () => {
    const summary = summarizeFollowUp(lessons, [], now)
    expect(summary.completionRate).toBeNull()
    expect(summary.onTimeRate).toBeNull()
    expect(formatRate(summary.completionRate)).toBe('—')
    expect(formatRate(2 / 3)).toBe('67%')
  })
})
