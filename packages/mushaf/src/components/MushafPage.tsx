'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { annotationCoversWord } from '../selection'
import type { MushafAnnotation, MushafPageData, MushafWord as MushafWordData } from '../types'
import { MushafWord } from './MushafWord'

interface MushafPageProps {
  page: MushafPageData
  annotations: MushafAnnotation[]
  selectedWordIds: Set<string>
  /** Only the first word of a selection is chosen so far. */
  selectionPending?: boolean
  dark?: boolean
  onSelectWord: (word: MushafWordData, element: HTMLElement) => void
}

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'
const QURAN_TEXT_FONT = 'var(--font-quran), "Amiri Quran", "Scheherazade New", serif'

// Space between words, in em: the widest line sets the size using MIN_GAP_EM;
// any other line that would need gaps wider than MAX_GAP_EM to reach the full
// width is centred at CENTRED_GAP_EM instead of being stretched apart.
const MIN_GAP_EM = 0.16
const MAX_GAP_EM = 0.38
const CENTRED_GAP_EM = 0.24

export function MushafPage({ page, annotations, selectedWordIds, selectionPending = false, dark = false, onSelectWord }: MushafPageProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(26)
  const [centred, setCentred] = useState<Set<number>>(new Set())
  const useGlyphs = page.fontsReady === true

  // Sizes the text so the widest line exactly fills the page width, then lets
  // every other line stretch to match -- like the justified printed page.
  const fit = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap || !wrap.clientWidth) return

    const available = wrap.clientWidth
    const lines = new Map<number, { words: number; gaps: number }>()
    wrap.querySelectorAll<HTMLElement>('[data-text-line]').forEach((line) => {
      const kids = Array.from(line.children) as HTMLElement[]
      const words = kids.reduce((sum, kid) => sum + kid.getBoundingClientRect().width, 0)
      lines.set(Number(line.dataset.textLine), { words, gaps: Math.max(kids.length - 1, 0) })
    })
    const widest = Math.max(0, ...[...lines.values()].map((l) => l.words + l.gaps * MIN_GAP_EM * fontSize))
    if (!widest) return

    const next = Math.min(Math.max((fontSize * available) / widest * 0.995, 12), 46)
    if (Math.abs(next - fontSize) > 0.25) setFontSize(next)

    // Judge each line at the size it is about to have: word widths scale with the font.
    const ratio = next / fontSize
    const short = new Set(
      [...lines]
        .filter(([, l]) => l.gaps === 0 || (available - l.words * ratio) / l.gaps > MAX_GAP_EM * next)
        .map(([line]) => line)
    )
    setCentred((prev) => (prev.size === short.size && [...short].every((n) => prev.has(n)) ? prev : short))
  }, [fontSize])

  useLayoutEffect(() => {
    fit()
  }, [fit, page, useGlyphs])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(() => fit())
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [fit])

  return (
    <div
      dir="rtl"
      lang="ar"
      className={`rounded-3xl border-2 p-2 shadow-card sm:p-3 ${dark ? 'border-amber-500/40 bg-[#17140f]' : 'border-amber-700/40 bg-[#fffdf6]'}`}
    >
      <div className={`rounded-2xl border px-3 py-4 sm:px-6 ${dark ? 'border-amber-500/25' : 'border-amber-700/25'}`}>
        <div ref={wrapRef} style={{ fontSize, lineHeight: 2.05 }} className={dark ? 'text-stone-100' : 'text-slate-900'}>
          {page.lines.map((line) => {
            if (line.kind === 'header') {
              return (
                <div
                  key={`h${line.lineNumber}`}
                  className={`my-1 rounded-md border-2 p-[3px] ${dark ? 'border-amber-500/60 bg-amber-950/40' : 'border-amber-700/60 bg-amber-50'}`}
                  style={{ fontFamily: QURAN_TEXT_FONT }}
                >
                  <div
                    className={`rounded-[4px] border py-0.5 text-center ${dark ? 'border-amber-500/40 text-amber-200' : 'border-amber-700/40 text-amber-900'}`}
                    style={{ fontSize: '0.8em', lineHeight: 1.7 }}
                  >
                    سُورَةُ {line.surahName}
                  </div>
                </div>
              )
            }
            if (line.kind === 'basmala') {
              return (
                <div key={`b${line.lineNumber}`} className="text-center" style={{ fontFamily: QURAN_TEXT_FONT, fontSize: '0.85em' }}>
                  {BASMALA}
                </div>
              )
            }
            return (
              <div
                key={line.lineNumber}
                data-text-line={line.lineNumber}
                className={`flex flex-nowrap items-center ${centred.has(line.lineNumber) ? 'justify-center' : 'justify-between'}`}
                style={{ gap: centred.has(line.lineNumber) ? `${CENTRED_GAP_EM}em` : undefined, fontFamily: useGlyphs ? undefined : QURAN_TEXT_FONT }}
              >
                {line.words.map((word) => (
                  <MushafWord
                    key={word.id}
                    word={word}
                    annotations={annotations.filter((a) => annotationCoversWord(a, word.id, page))}
                    selected={selectedWordIds.has(word.id)}
                    pending={selectionPending}
                    useGlyphs={useGlyphs}
                    dark={dark}
                    onSelect={onSelectWord}
                  />
                ))}
              </div>
            )
          })}
        </div>
        <p className={`mt-2 text-center text-sm ${dark ? 'text-amber-300' : 'text-amber-800'}`} style={{ fontFamily: QURAN_TEXT_FONT }}>
          {page.page.toLocaleString('ar-EG')}
        </p>
      </div>
    </div>
  )
}
