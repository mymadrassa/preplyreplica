// The 30 juz' of the Madinah Mushaf (604 pages, Hafs): the page each one starts on.
export const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
]

/** The page a juz' (1–30) starts on. */
export function juzStartPage(juz: number): number {
  return JUZ_START_PAGES[Math.min(30, Math.max(1, Math.round(juz))) - 1]
}

/** The juz' a page belongs to (the one that starts on or before it). */
export function juzForPage(page: number): number {
  let juz = 1
  for (let i = 0; i < JUZ_START_PAGES.length; i++) {
    if (JUZ_START_PAGES[i] <= page) juz = i + 1
    else break
  }
  return juz
}
