// Placeholder taxonomy for teacher subjects/languages. Replace with a real
// managed list (e.g. a database table) once the catalog needs to grow beyond
// a fixed set or be editable by admins.
export const SUBJECTS = [
  'English',
  'Math',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'History',
  'Economics',
  'Music',
  'Art',
]

export const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Mandarin',
  'Japanese',
  'Arabic',
  'Russian',
]

// Displayed Monday-first, but values stay aligned with JS Date.getDay()
// (0 = Sunday ... 6 = Saturday) since that's what a real calendar date
// resolves to — only the display order changes, not the stored meaning.
export const WEEKDAYS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
]

export const WEEKDAY_LABELS: Record<number, string> = Object.fromEntries(
  WEEKDAYS.map((day) => [Number(day.value), day.label])
)

// Half-hour increments across a full day, e.g. "06:00" -> "6:00 AM".
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = i * 30
  const hours24 = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const value = `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  const period = hours24 < 12 ? 'AM' : 'PM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const label = `${hours12}:${String(minutes).padStart(2, '0')} ${period}`
  return { value, label }
})
