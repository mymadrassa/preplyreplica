import { describe, expect, it } from 'vitest'
import { canBeMatched, filterTeachersForViewer } from '../gender'

const teachers = [
  { id: 'a', gender: 'female' },
  { id: 'b', gender: 'male' },
  { id: 'c', gender: null },
]
const ids = (list: { id: string }[]) => list.map((t) => t.id)
const genderOf = (t: { gender: string | null }) => t.gender

describe('canBeMatched', () => {
  it('needs both genders set and equal', () => {
    expect(canBeMatched('female', 'female')).toBe(true)
    expect(canBeMatched('male', 'female')).toBe(false)
    expect(canBeMatched(null, null)).toBe(false)
    expect(canBeMatched('male', null)).toBe(false)
  })
})

describe('filterTeachersForViewer', () => {
  it('shows everyone to guests, teachers and admins', () => {
    expect(ids(filterTeachersForViewer(teachers, { role: null, gender: null }, genderOf))).toEqual(['a', 'b', 'c'])
    expect(ids(filterTeachersForViewer(teachers, { role: 'admin', gender: null }, genderOf))).toEqual(['a', 'b', 'c'])
  })

  it('shows a student only teachers of their gender', () => {
    expect(ids(filterTeachersForViewer(teachers, { role: 'student', gender: 'female' }, genderOf))).toEqual(['a'])
    expect(ids(filterTeachersForViewer(teachers, { role: 'student', gender: 'male' }, genderOf))).toEqual(['b'])
  })

  it('shows a student without a gender nobody', () => {
    expect(filterTeachersForViewer(teachers, { role: 'student', gender: null }, genderOf)).toEqual([])
  })
})
