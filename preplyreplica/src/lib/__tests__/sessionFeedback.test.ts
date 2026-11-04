import { describe, expect, it } from 'vitest'
import { describeTags, feedbackSchema, isFeedbackDue } from '../sessionFeedback'

describe('feedbackSchema', () => {
  it('accepts a skip from either side', () => {
    expect(feedbackSchema('student').safeParse({ skip: true }).success).toBe(true)
    expect(feedbackSchema('teacher').safeParse({ skip: true }).success).toBe(true)
  })

  it('needs a rating and a visibility from the student', () => {
    expect(feedbackSchema('student').safeParse({ rating: 5, visibility: 'public' }).success).toBe(true)
    expect(feedbackSchema('student').safeParse({ rating: 5 }).success).toBe(false)
    expect(feedbackSchema('student').safeParse({ rating: 0, visibility: 'private' }).success).toBe(false)
    expect(feedbackSchema('student').safeParse({ visibility: 'private', comment: 'Nice' }).success).toBe(false)
  })

  it('needs at least one known tag from the teacher', () => {
    expect(feedbackSchema('teacher').safeParse({ tags: ['great_effort', 'hesitant'] }).success).toBe(true)
    expect(feedbackSchema('teacher').safeParse({ tags: [] }).success).toBe(false)
    expect(feedbackSchema('teacher').safeParse({ tags: ['made_up'] }).success).toBe(false)
  })
})

describe('isFeedbackDue', () => {
  const now = new Date('2026-10-20T12:00:00Z')
  const lesson = { start_at: '2026-10-20T10:00:00Z', end_at: '2026-10-20T11:00:00Z', status: 'confirmed' }

  it('asks once a lesson that went ahead has ended', () => {
    expect(isFeedbackDue(lesson, now)).toBe(true)
    expect(isFeedbackDue({ ...lesson, status: 'completed' }, now)).toBe(true)
  })

  it('waits for the end, unless forced after hanging up', () => {
    const during = new Date('2026-10-20T10:50:00Z')
    expect(isFeedbackDue(lesson, during)).toBe(false)
    expect(isFeedbackDue(lesson, during, { force: true })).toBe(true)
    expect(isFeedbackDue(lesson, new Date('2026-10-20T09:00:00Z'), { force: true })).toBe(false)
  })

  it('ignores cancelled and old lessons', () => {
    expect(isFeedbackDue({ ...lesson, status: 'cancelled' }, now)).toBe(false)
    expect(isFeedbackDue(lesson, new Date('2026-11-10T12:00:00Z'))).toBe(false)
  })
})

describe('describeTags', () => {
  it('labels known tags with their tone and drops unknown ones', () => {
    expect(describeTags(['great_effort', 'nope', 'hesitant'])).toEqual([
      { key: 'great_effort', label: 'Great effort', encouraging: true },
      { key: 'hesitant', label: 'Hesitant', encouraging: false },
    ])
  })
})
