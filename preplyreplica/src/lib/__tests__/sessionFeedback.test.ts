import { describe, expect, it } from 'vitest'
import { averageCriteria, canReport, describeCriteria, describeTags, feedbackSchema, isFeedbackDue, reportReasonLabel, reportSchema } from '../sessionFeedback'

const studentScores = { teaching: 5, punctuality: 4, preparation: 5, patience: 5, connection: 3 }
const teacherScores = { revision: 4, punctuality: 5, focus: 4, connection: 5 }

describe('feedbackSchema', () => {
  it('accepts a skip from either side', () => {
    expect(feedbackSchema('student').safeParse({ skip: true }).success).toBe(true)
    expect(feedbackSchema('teacher').safeParse({ skip: true }).success).toBe(true)
  })

  it('needs a rating, a visibility and every criterion from the student', () => {
    expect(feedbackSchema('student').safeParse({ rating: 5, visibility: 'public', criteria: studentScores }).success).toBe(true)
    expect(feedbackSchema('student').safeParse({ rating: 5, visibility: 'public' }).success).toBe(false)
    expect(feedbackSchema('student').safeParse({ rating: 5, criteria: studentScores }).success).toBe(false)
    expect(feedbackSchema('student').safeParse({ rating: 0, visibility: 'private', criteria: studentScores }).success).toBe(false)
    const { connection: _missing, ...partial } = studentScores
    expect(feedbackSchema('student').safeParse({ rating: 5, visibility: 'public', criteria: partial }).success).toBe(false)
    expect(feedbackSchema('student').safeParse({ rating: 5, visibility: 'public', criteria: { ...studentScores, teaching: 6 } }).success).toBe(false)
  })

  it('needs every criterion from the teacher; tags are optional but must be known', () => {
    expect(feedbackSchema('teacher').safeParse({ criteria: teacherScores }).success).toBe(true)
    expect(feedbackSchema('teacher').safeParse({ criteria: teacherScores, tags: ['great_effort', 'hesitant'] }).success).toBe(true)
    expect(feedbackSchema('teacher').safeParse({ tags: ['great_effort'] }).success).toBe(false)
    expect(feedbackSchema('teacher').safeParse({ criteria: teacherScores, tags: ['made_up'] }).success).toBe(false)
  })

  it('keeps only the known criteria', () => {
    const parsed = feedbackSchema('teacher').safeParse({ criteria: { ...teacherScores, extra: 1 } })
    expect(parsed.success && 'criteria' in parsed.data ? parsed.data.criteria : null).toEqual(teacherScores)
  })
})

describe('reports', () => {
  const lesson = { start_at: '2026-10-20T10:00:00Z', end_at: '2026-10-20T11:00:00Z', status: 'confirmed' }

  it('need a reason and a few words', () => {
    expect(reportSchema.safeParse({ reason: 'no_show', detail: 'The teacher never joined the room.' }).success).toBe(true)
    expect(reportSchema.safeParse({ reason: 'no_show', detail: 'no' }).success).toBe(false)
    expect(reportSchema.safeParse({ reason: 'late', detail: 'The teacher was very late.' }).success).toBe(false)
  })

  it('are open from the start until 48 hours after the end', () => {
    expect(canReport(lesson, new Date('2026-10-20T09:59:00Z'))).toBe(false)
    expect(canReport(lesson, new Date('2026-10-20T10:30:00Z'))).toBe(true)
    expect(canReport(lesson, new Date('2026-10-22T10:59:00Z'))).toBe(true)
    expect(canReport(lesson, new Date('2026-10-22T11:01:00Z'))).toBe(false)
    expect(canReport({ ...lesson, status: 'cancelled' }, new Date('2026-10-20T12:00:00Z'))).toBe(false)
  })

  it('name the absent side for each reporter', () => {
    expect(reportReasonLabel('no_show', 'student')).toBe("The teacher didn't show up")
    expect(reportReasonLabel('no_show', 'teacher')).toBe("The student didn't show up")
  })
})

describe('criteria summaries', () => {
  it('average each criterion over several lessons', () => {
    expect(averageCriteria('teacher', [teacherScores, { ...teacherScores, revision: 2 }, null])[0]).toEqual({ key: 'revision', label: 'Revision done (preparation)', average: 3, count: 2 })
    expect(describeCriteria('student', { teaching: 5, unknown: 1 })).toEqual([{ key: 'teaching', label: 'Teaching and explanations', score: 5 }])
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
