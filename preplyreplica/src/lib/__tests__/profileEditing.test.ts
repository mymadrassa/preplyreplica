import { describe, expect, it } from 'vitest'
import { diffProfileChanges, profileEditMode, type ReviewedValues } from '../profileEditing'

describe('profileEditMode', () => {
  it.each([
    ['draft', null, 'edit'],
    ['rejected', null, 'edit'],
    ['pending', null, 'locked'],
    ['approved', null, 'review-edit'],
    ['approved', 'draft', 'review-edit'],
    ['approved', 'submitted', 'locked'],
    ['suspended', null, 'review-edit'],
    ['suspended', 'submitted', 'locked'],
  ] as const)('%s profile with %s changes → %s', (status, changes, mode) => {
    expect(profileEditMode(status, changes)).toBe(mode)
  })
})

describe('diffProfileChanges', () => {
  const live: ReviewedValues = {
    headline: 'Quran teacher',
    bio: 'Old bio',
    subjects: ['Quran', 'Arabic'],
    languages: ['Arabic'],
    video_url: null,
    avatar_url: 'a.jpg',
  }

  it('reports nothing when the copy matches the live profile', () => {
    expect(diffProfileChanges(live, { ...live, subjects: ['Arabic', 'Quran'] })).toEqual([])
  })

  it('reports each changed field with its before and after', () => {
    const changes = diffProfileChanges(live, { ...live, bio: 'New bio', avatar_url: 'b.jpg', languages: ['Arabic', 'English'] })
    expect(changes.map((c) => c.field)).toEqual(['bio', 'languages', 'avatar_url'])
    expect(changes[0]).toEqual({ field: 'bio', label: 'Bio', before: 'Old bio', after: 'New bio' })
  })

  it('treats an empty and a missing video as the same', () => {
    expect(diffProfileChanges(live, { ...live, video_url: '' })).toEqual([])
  })
})
