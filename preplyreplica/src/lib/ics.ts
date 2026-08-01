function escapeICSText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function toICSDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export function generateBookingICS({
  bookingId,
  subject,
  startAt,
  endAt,
  teacherName,
  studentName,
  meetingUrl,
}: {
  bookingId: string
  subject: string
  startAt: string
  endAt: string
  teacherName: string
  studentName: string
  meetingUrl: string
}) {
  const now = toICSDate(new Date())
  const description = `Lesson: ${subject}\\nWith: ${teacherName} & ${studentName}\\nJoin: ${meetingUrl}`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Preply Clone//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${bookingId}@preply-clone`,
    `DTSTAMP:${now}`,
    `DTSTART:${toICSDate(new Date(startAt))}`,
    `DTEND:${toICSDate(new Date(endAt))}`,
    `SUMMARY:${escapeICSText(`${subject} lesson — ${teacherName} & ${studentName}`)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    `LOCATION:${escapeICSText(meetingUrl)}`,
    `URL:${meetingUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lesson reminder',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join('\r\n')
}
