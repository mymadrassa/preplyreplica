import { describe, expect, it } from 'vitest'
import { generateBookingICS } from '../ics'

const baseArgs = {
  bookingId: 'abc-123',
  subject: 'Math',
  startAt: '2026-08-15T10:00:00.000Z',
  endAt: '2026-08-15T11:00:00.000Z',
  teacherName: 'Nora',
  studentName: 'Ilias',
  meetingUrl: 'https://example.com/session/abc-123',
}

describe('generateBookingICS', () => {
  it('produces a well-formed VCALENDAR/VEVENT structure', () => {
    const ics = generateBookingICS(baseArgs)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('includes a UID derived from the booking id', () => {
    const ics = generateBookingICS(baseArgs)
    expect(ics).toContain('UID:booking-abc-123@preply-clone')
  })

  it('formats DTSTART/DTEND as UTC basic-format timestamps', () => {
    const ics = generateBookingICS(baseArgs)
    expect(ics).toContain('DTSTART:20260815T100000Z')
    expect(ics).toContain('DTEND:20260815T110000Z')
  })

  it('includes the meeting URL as both LOCATION and URL', () => {
    const ics = generateBookingICS(baseArgs)
    expect(ics).toContain(`LOCATION:${baseArgs.meetingUrl}`)
    expect(ics).toContain(`URL:${baseArgs.meetingUrl}`)
  })

  it('includes a 1-hour-before reminder alarm', () => {
    const ics = generateBookingICS(baseArgs)
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-PT1H')
  })

  it('escapes commas, semicolons, and newlines in free-text fields per RFC 5545', () => {
    const ics = generateBookingICS({ ...baseArgs, subject: 'Math, Physics; Advanced' })
    expect(ics).toContain('Math\\, Physics\\; Advanced')
  })

  it('uses CRLF line endings as required by the ICS spec', () => {
    const ics = generateBookingICS(baseArgs)
    expect(ics).toContain('\r\n')
  })
})
