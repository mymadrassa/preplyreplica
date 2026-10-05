import { describe, expect, it } from 'vitest'
import { rankTeachersForStudent, scoreTeacherForStudent, type StudentSignal, type TeacherSignal } from '../recommendation'

function teacher(overrides: Partial<TeacherSignal> = {}): TeacherSignal {
  return {
    id: 'teacher-1',
    subjects: ['Math'],
    hourlyRate: 20,
    ratingAvg: 4,
    ratingCount: 20,
    availabilitySlots: [],
    availabilityExceptions: [],
    ...overrides,
  }
}

function student(overrides: Partial<StudentSignal> = {}): StudentSignal {
  return {
    courses: ['Math'],
    weeklySlots: [],
    ...overrides,
  }
}

describe('scoreTeacherForStudent — subject match', () => {
  it('scores 1 when every requested course is taught', () => {
    const result = scoreTeacherForStudent(student({ courses: ['Math'] }), teacher({ subjects: ['Math', 'Physics'] }))
    expect(result.breakdown.subjectMatch).toBe(1)
  })

  it('scores a partial fraction when only some requested courses are taught', () => {
    const result = scoreTeacherForStudent(student({ courses: ['Math', 'Art'] }), teacher({ subjects: ['Math'] }))
    expect(result.breakdown.subjectMatch).toBe(0.5)
  })
})

describe('scoreTeacherForStudent — availability overlap', () => {
  it('matches a requested weekly window against the teacher real availability via getOpenRanges', () => {
    // weekday 3 = Wednesday
    const result = scoreTeacherForStudent(
      student({ weeklySlots: [{ weekday: 3, start_time: '18:00', end_time: '19:00' }] }),
      teacher({ availabilitySlots: [{ weekday: 3, start_time: '17:00', end_time: '20:00' }] })
    )
    expect(result.breakdown.availabilityOverlap).toBe(1)
  })

  it('scores 0 overlap when the teacher has no open slot on the requested weekday', () => {
    const result = scoreTeacherForStudent(
      student({ weeklySlots: [{ weekday: 3, start_time: '18:00', end_time: '19:00' }] }),
      teacher({ availabilitySlots: [{ weekday: 1, start_time: '17:00', end_time: '20:00' }] })
    )
    expect(result.breakdown.availabilityOverlap).toBe(0)
  })
})

describe('scoreTeacherForStudent — rating', () => {
  it('treats a teacher with no reviews as neutral (0.5), not zero', () => {
    const result = scoreTeacherForStudent(student(), teacher({ ratingAvg: 0, ratingCount: 0 }))
    expect(result.breakdown.rating).toBe(0.5)
  })

  it('dampens a high rating backed by few reviews below the same rating backed by many', () => {
    const fewReviews = scoreTeacherForStudent(student(), teacher({ ratingAvg: 5, ratingCount: 1 }))
    const manyReviews = scoreTeacherForStudent(student(), teacher({ ratingAvg: 5, ratingCount: 20 }))
    expect(fewReviews.breakdown.rating).toBeLessThan(manyReviews.breakdown.rating)
  })
})

describe('scoreTeacherForStudent — price fit', () => {
  it('is null (not zero) and excluded from the weighted total when no budget was given', () => {
    const result = scoreTeacherForStudent(student(), teacher({ hourlyRate: 1000 }))
    expect(result.breakdown.priceFit).toBeNull()
    // With no budget, an expensive teacher's score should still be driven by
    // subject/availability/rating alone, not crushed by an implicit price=0.
    expect(result.score).toBeGreaterThan(0.5)
  })

  it('scores 1 when within budget and decays as the rate exceeds it', () => {
    const withinBudget = scoreTeacherForStudent(student({ maxHourlyRate: 30 }), teacher({ hourlyRate: 20 }))
    const overBudget = scoreTeacherForStudent(student({ maxHourlyRate: 30 }), teacher({ hourlyRate: 60 }))
    expect(withinBudget.breakdown.priceFit).toBe(1)
    expect(overBudget.breakdown.priceFit).toBeLessThan(1)
  })
})

describe('rankTeachersForStudent', () => {
  it('sorts teachers by score, descending', () => {
    const strongMatch = teacher({ id: 'strong', subjects: ['Math'], ratingAvg: 5, ratingCount: 50 })
    const weakMatch = teacher({ id: 'weak', subjects: ['Art'], ratingAvg: 2, ratingCount: 50 })
    const ranked = rankTeachersForStudent(student({ courses: ['Math'] }), [weakMatch, strongMatch])
    expect(ranked.map((r) => r.teacherId)).toEqual(['strong', 'weak'])
  })
})
