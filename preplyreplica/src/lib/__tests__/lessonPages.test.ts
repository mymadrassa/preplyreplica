import { describe, expect, it } from 'vitest'
import { formatPageRanges, pagesByBooking } from '../lessonPages'

describe('formatPageRanges', () => {
  it('collapses consecutive pages into ranges', () => {
    expect(formatPageRanges([15, 12, 13, 14, 20, 20])).toBe('Pages 12–15, 20')
    expect(formatPageRanges([3])).toBe('Page 3')
    expect(formatPageRanges([1, 3, 5])).toBe('Pages 1, 3, 5')
    expect(formatPageRanges([])).toBe('')
  })
})

describe('pagesByBooking', () => {
  it('groups pages per lesson', () => {
    expect(pagesByBooking([{ booking_id: 'a', page: 1 }, { booking_id: 'b', page: 2 }, { booking_id: 'a', page: 3 }]).get('a')).toEqual([1, 3])
  })
})
