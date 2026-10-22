import { describe, expect, it } from 'vitest'
import { getTeacherReadiness, type TeacherReadinessInput } from '../teacherReadiness'

const complete: TeacherReadinessInput = {
  headline: 'Patient Quran teacher',
  bio: 'I have taught tajwid and memorisation for ten years.',
  subjects: ['Quran'],
  languages: ['Arabic'],
  hourly_rate: 20,
  avatar_url: 'https://example.com/me.jpg',
  identityDocumentCount: 1,
  stripe_charges_enabled: true,
}

describe('getTeacherReadiness', () => {
  it('allows submitting when every mandatory step is done', () => {
    const readiness = getTeacherReadiness(complete)
    expect(readiness.canSubmit).toBe(true)
    expect(readiness.missing).toEqual([])
  })

  const cases: ['profile' | 'photo' | 'identity' | 'payouts', Partial<TeacherReadinessInput>][] = [
    ['profile', { bio: 'too short' }],
    ['profile', { subjects: [] }],
    ['profile', { hourly_rate: 5 }],
    ['photo', { avatar_url: null }],
    ['identity', { identityDocumentCount: 0 }],
    ['payouts', { stripe_charges_enabled: false }],
  ]

  it.each(cases)('blocks submitting and lists %s when it is missing', (key, change) => {
    const readiness = getTeacherReadiness({ ...complete, ...change })
    expect(readiness.canSubmit).toBe(false)
    expect(readiness.missing.map((m) => m.key)).toEqual([key])
    expect(readiness[key]).toBe(false)
  })

  it('lists every missing item with the link that fixes it, in order', () => {
    const readiness = getTeacherReadiness({
      headline: null,
      bio: null,
      subjects: [],
      languages: [],
      hourly_rate: null,
      avatar_url: null,
      identityDocumentCount: 0,
      stripe_charges_enabled: false,
    })
    expect(readiness.missing.map((m) => [m.key, m.href])).toEqual([
      ['profile', '/teacher/profile/details'],
      ['photo', '/teacher/profile/photo'],
      ['identity', '/teacher/profile/identity'],
      ['payouts', '/teacher/profile/payouts'],
    ])
  })
})
