import { describe, expect, it } from 'vitest'
import { joinWindow, lessonRoomName } from '../lessonRoom'

const lesson = { start_at: '2026-11-06T10:00:00Z', end_at: '2026-11-06T11:00:00Z' }

describe('joinWindow', () => {
  it('opens 10 minutes before the start', () => {
    expect(joinWindow(lesson, new Date('2026-11-06T09:49:00Z')).state).toBe('too-early')
    expect(joinWindow(lesson, new Date('2026-11-06T09:50:00Z')).state).toBe('open')
  })

  it('lets people rejoin at any time during the lesson and 30 minutes after it', () => {
    expect(joinWindow(lesson, new Date('2026-11-06T10:45:00Z')).state).toBe('open')
    expect(joinWindow(lesson, new Date('2026-11-06T11:30:00Z')).state).toBe('open')
    expect(joinWindow(lesson, new Date('2026-11-06T11:31:00Z')).state).toBe('ended')
  })
})

describe('lessonRoomName', () => {
  it('is stable for a booking and different between bookings', () => {
    expect(lessonRoomName('a')).toBe(lessonRoomName('a'))
    expect(lessonRoomName('a')).not.toBe(lessonRoomName('b'))
    expect(lessonRoomName('a')).toMatch(/^lesson-[0-9a-f]{20}$/)
  })
})
