'use client'

import { useEffect, useState } from 'react'
import { getTotalPages } from '../data'
import { Icon } from './icons'

interface PageNavProps {
  currentPage: number
  /** Only the teacher drives the page; the student sees it follow. */
  canNavigate: boolean
  /** The viewer is looking at a page of their own, not the teacher's. */
  detached?: boolean
  onChange: (page: number) => void
}

export function PageNav({ currentPage, canNavigate, detached = false, onChange }: PageNavProps) {
  const totalPages = getTotalPages()
  const [draft, setDraft] = useState(String(currentPage))

  useEffect(() => {
    setDraft(String(currentPage))
  }, [currentPage])

  const buttonClass =
    'flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

  // The Mushaf reads right to left, so "next" points left.
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" title="Next page" aria-label="Next page" className={buttonClass} disabled={!canNavigate || currentPage >= totalPages} onClick={() => onChange(currentPage + 1)}>
        <Icon name="chevron-left" />
      </button>
      <form
        className="flex items-center gap-2 text-sm text-slate-600"
        onSubmit={(event) => {
          event.preventDefault()
          if (canNavigate) onChange(Number(draft))
        }}
      >
        <label htmlFor="mushaf-page-input" className="sr-only">
          Page
        </label>
        <input
          id="mushaf-page-input"
          type="number"
          min={1}
          max={totalPages}
          value={draft}
          disabled={!canNavigate}
          onChange={(event) => setDraft(event.target.value)}
          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-slate-900 disabled:bg-slate-50"
        />
        <span>/ {totalPages}</span>
        {!canNavigate ? <span className="text-xs text-slate-400">{detached ? '· browsing on your own' : '· following your teacher'}</span> : null}
      </form>
      <button type="button" title="Previous page" aria-label="Previous page" className={buttonClass} disabled={!canNavigate || currentPage <= 1} onClick={() => onChange(currentPage - 1)}>
        <Icon name="chevron-right" />
      </button>
    </div>
  )
}
