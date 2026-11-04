// Same-gender teaching: a student is only matched with a teacher of the same
// gender. The database enforces it for bookings and conversations
// (migration 0033); this decides what each viewer is shown.

export type Gender = 'male' | 'female'

export const GENDERS: { value: Gender; label: string; teachers: string }[] = [
  { value: 'male', label: 'Male', teachers: 'male teachers' },
  { value: 'female', label: 'Female', teachers: 'female teachers' },
]

export function isGender(value: unknown): value is Gender {
  return value === 'male' || value === 'female'
}

/** Both known and equal: anything else is never a match. */
export function canBeMatched(studentGender: string | null | undefined, teacherGender: string | null | undefined): boolean {
  return isGender(studentGender) && studentGender === teacherGender
}

export interface TeacherViewer {
  role: 'student' | 'teacher' | 'admin' | null
  gender: string | null
}

/**
 * The teachers a viewer may see. Guests, teachers and admins see everyone; a
 * student sees only teachers of their own gender (teachers who haven't said
 * theirs stay hidden), and none until their own gender is known.
 */
export function filterTeachersForViewer<T>(teachers: T[], viewer: TeacherViewer, genderOf: (teacher: T) => string | null | undefined): T[] {
  if (viewer.role !== 'student') return teachers
  return teachers.filter((teacher) => canBeMatched(viewer.gender, genderOf(teacher)))
}
