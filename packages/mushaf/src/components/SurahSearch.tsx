'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchChapters } from '../data/quranCom'
import { filterSurahs, surahListFromChapters, type SurahEntry } from '../surahSearch'
import { Icon } from './icons'
import { Spinner } from './Spinner'

interface SurahSearchProps {
  onSelect: (startPage: number) => void
}

// Type an Arabic or English surah name (or its number) to narrow the list;
// nothing is shown until something is typed.
export function SurahSearch({ onSelect }: SurahSearchProps) {
  const [surahs, setSurahs] = useState<SurahEntry[]>([])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetchChapters().then((chapters) => {
      if (!cancelled && chapters) setSurahs(surahListFromChapters(chapters))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const matches = useMemo(() => filterSurahs(surahs, query), [surahs, query])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    if (!query) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setQuery('')
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [query])

  function choose(surah: SurahEntry) {
    onSelect(surah.startPage)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-xs">
      <label htmlFor="mushaf-surah-search" className="sr-only">
        Search a surah
      </label>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        id="mushaf-surah-search"
        type="search"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls="mushaf-surah-results"
        aria-autocomplete="list"
        value={query}
        placeholder="Search a surah…  ابحث عن سورة"
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setQuery('')
          else if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((i) => Math.min(i + 1, matches.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (event.key === 'Enter' && matches[active]) {
            event.preventDefault()
            choose(matches[active])
          }
        }}
        className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
      />

      {query.trim() ? (
        <ul
          id="mushaf-surah-results"
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-lift"
        >
          {matches.length ? (
            matches.map((surah, index) => (
              <li key={surah.id} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onClick={() => choose(surah)}
                  onMouseEnter={() => setActive(index)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${index === active ? 'bg-brand-50' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="mr-2 text-xs text-slate-400">{surah.id}</span>
                    <span className="text-slate-900">{surah.english}</span>
                    <span className="ml-2 text-xs text-slate-400">p. {surah.startPage}</span>
                  </span>
                  <span dir="rtl" lang="ar" className="text-lg text-slate-800" style={{ fontFamily: 'var(--font-quran), "Amiri Quran", serif' }}>
                    {surah.arabic}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400">
              {surahs.length ? (
                'No surah found'
              ) : (
                <>
                  <Spinner className="h-4 w-4 text-brand-600" /> Loading…
                </>
              )}
            </li>
          )}
        </ul>
      ) : null}
    </div>
  )
}
