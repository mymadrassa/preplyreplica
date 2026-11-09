/** Pages as compact ranges, e.g. [12, 13, 14, 15, 20] → "Pages 12–15, 20"; empty when there are none. */
export function formatPageRanges(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  if (!sorted.length) return ''
  const ranges: string[] = []
  let start = sorted[0]
  let previous = sorted[0]
  for (const page of [...sorted.slice(1), Infinity]) {
    if (page === previous + 1) {
      previous = page
      continue
    }
    ranges.push(start === previous ? String(start) : `${start}–${previous}`)
    start = previous = page
  }
  return `${sorted.length === 1 ? 'Page' : 'Pages'} ${ranges.join(', ')}`
}

/** Groups lesson_pages rows by lesson. */
export function pagesByBooking(rows: { booking_id: string; page: number }[]): Map<string, number[]> {
  const byBooking = new Map<string, number[]>()
  for (const row of rows) byBooking.set(row.booking_id, [...(byBooking.get(row.booking_id) ?? []), row.page])
  return byBooking
}
