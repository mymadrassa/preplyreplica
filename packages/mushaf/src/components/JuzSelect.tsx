'use client'

import { JUZ_START_PAGES, juzForPage } from '../juz'

/** Jump to the start of a juz'. Shows the juz' of the page being viewed. */
export function JuzSelect({ currentPage, onSelect }: { currentPage: number; onSelect: (startPage: number) => void }) {
  return (
    <label className="flex items-center">
      <span className="sr-only">Go to juz'</span>
      <select
        value={juzForPage(currentPage)}
        onChange={(event) => onSelect(JUZ_START_PAGES[Number(event.target.value) - 1])}
        title="Go to juz'"
        className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
      >
        {JUZ_START_PAGES.map((_, index) => (
          <option key={index} value={index + 1}>
            Juz' {index + 1}
          </option>
        ))}
      </select>
    </label>
  )
}
