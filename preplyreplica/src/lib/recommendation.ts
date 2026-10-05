// Rule-based teacher recommendation scoring for the student onboarding
// wizard. There is no training data yet (no logged impressions/selections at
// the time this was written), so this is deliberately NOT ML -- it's a
// transparent, inspectable weighted formula. `rankTeachersForStudent` is the
// only entry point callers use; its signature is the swap point for a future
// learned ranker (collaborative filtering, a trained model, etc.) once
// `recommendation_events` has accumulated enough rows to train on.
//
// `TeacherSignal` is a narrow, hand-picked projection by design: name, photo,
// nationality, accent, or anything else not listed below is never read by
// this module, so nothing discriminatory can leak into the score.

import { getOpenRanges, overlaps, toMinutes, type AvailabilityException, type AvailabilitySlot } from './availability'

export interface StudentSignal {
  courses: string[]
  weeklySlots: { weekday: number; start_time: string; end_time: string }[]
  maxHourlyRate?: number
}

export interface TeacherSignal {
  id: string
  subjects: string[]
  hourlyRate: number
  ratingAvg: number
  ratingCount: number
  availabilitySlots: AvailabilitySlot[]
  availabilityExceptions: AvailabilityException[]
}

export interface TeacherScore {
  teacherId: string
  score: number
  breakdown: {
    subjectMatch: number
    availabilityOverlap: number
    rating: number
    priceFit: number | null
  }
}

const WEIGHTS = {
  subjectMatch: 0.4,
  availabilityOverlap: 0.3,
  rating: 0.2,
  priceFit: 0.1,
}

function scoreSubjectMatch(studentCourses: string[], teacherSubjects: string[]): number {
  if (!studentCourses.length) return 0
  const matched = studentCourses.filter((course) => teacherSubjects.includes(course)).length
  return matched / studentCourses.length
}

// The student's weekly slots are a preference ("Tuesday evenings"), not a
// real calendar date, so each one is projected onto the next occurrence of
// that weekday to reuse `getOpenRanges`'s date-based exception logic without
// duplicating it.
function nextOccurrenceOfWeekday(weekday: number): Date {
  const date = new Date()
  const diff = (weekday - date.getDay() + 7) % 7
  date.setDate(date.getDate() + diff)
  return date
}

function scoreAvailabilityOverlap(
  studentSlots: StudentSignal['weeklySlots'],
  teacherAvailabilitySlots: AvailabilitySlot[],
  teacherAvailabilityExceptions: AvailabilityException[]
): number {
  if (!studentSlots.length) return 0
  const matched = studentSlots.filter((wanted) => {
    const date = nextOccurrenceOfWeekday(wanted.weekday)
    const openRanges = getOpenRanges(date, teacherAvailabilitySlots, teacherAvailabilityExceptions)
    const wantedStart = toMinutes(wanted.start_time)
    const wantedEnd = toMinutes(wanted.end_time)
    return openRanges.some(([open, close]) => overlaps(wantedStart, wantedEnd, open, close))
  }).length
  return matched / studentSlots.length
}

function scoreRating(ratingAvg: number, ratingCount: number): number {
  // No reviews yet is treated as neutral, not zero, so brand-new approved
  // teachers aren't permanently buried under reviewed ones.
  if (ratingCount === 0) return 0.5
  return (ratingAvg / 5) * Math.min(1, ratingCount / 10)
}

function scorePriceFit(maxHourlyRate: number | undefined, hourlyRate: number): number | null {
  if (maxHourlyRate === undefined) return null
  if (hourlyRate <= maxHourlyRate) return 1
  return Math.max(0, 1 - (hourlyRate - maxHourlyRate) / maxHourlyRate)
}

export function scoreTeacherForStudent(student: StudentSignal, teacher: TeacherSignal): TeacherScore {
  const subjectMatch = scoreSubjectMatch(student.courses, teacher.subjects)
  const availabilityOverlap = scoreAvailabilityOverlap(student.weeklySlots, teacher.availabilitySlots, teacher.availabilityExceptions)
  const rating = scoreRating(teacher.ratingAvg, teacher.ratingCount)
  const priceFit = scorePriceFit(student.maxHourlyRate, teacher.hourlyRate)

  // When a signal isn't available (today: priceFit, since the wizard never
  // asks for a budget), its weight is redistributed proportionally across
  // the remaining signals rather than silently scoring it 0.
  const presentWeights = {
    subjectMatch: WEIGHTS.subjectMatch,
    availabilityOverlap: WEIGHTS.availabilityOverlap,
    rating: WEIGHTS.rating,
    ...(priceFit !== null ? { priceFit: WEIGHTS.priceFit } : {}),
  }
  const totalWeight = Object.values(presentWeights).reduce((sum, w) => sum + w, 0)

  const score =
    (subjectMatch * presentWeights.subjectMatch +
      availabilityOverlap * presentWeights.availabilityOverlap +
      rating * presentWeights.rating +
      (priceFit ?? 0) * (presentWeights.priceFit ?? 0)) /
    totalWeight

  return {
    teacherId: teacher.id,
    score,
    breakdown: { subjectMatch, availabilityOverlap, rating, priceFit },
  }
}

export function rankTeachersForStudent(student: StudentSignal, teachers: TeacherSignal[]): TeacherScore[] {
  return teachers.map((teacher) => scoreTeacherForStudent(student, teacher)).sort((a, b) => b.score - a.score)
}
