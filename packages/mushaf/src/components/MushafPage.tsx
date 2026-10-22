'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { annotationCoversWord, flattenWords, highlightRuns, noteIconWordIds, selectionBands, type Band, type WordBox } from '../selection'
import { INDOPAK_FAMILY } from '../data/indopakFont'
import { renderModeFor, type MushafScript } from '../script'
import type { MushafAnnotation, MushafPageData, MushafWord as MushafWordData } from '../types'
import { MushafWord } from './MushafWord'

interface MushafPageProps {
  page: MushafPageData
  annotations: MushafAnnotation[]
  selectedWordIds: Set<string>
  /** Only the first word of a selection is chosen so far. */
  selectionPending?: boolean
  dark?: boolean
  /** Madinah or IndoPak script; both share this layout. */
  script?: MushafScript
  onSelectWord: (word: MushafWordData, element: HTMLElement) => void
}

// Highlight fills, painted as blocks behind the text (the dark page uses softer, see-through tones).
const HIGHLIGHT_FILL: Record<string, { light: string; dark: string }> = {
  yellow: { light: '#fef08a', dark: 'rgba(250, 204, 21, 0.35)' },
  green: { light: '#a7f3d0', dark: 'rgba(52, 211, 153, 0.35)' },
  blue: { light: '#bae6fd', dark: 'rgba(56, 189, 248, 0.35)' },
  pink: { light: '#fbcfe8', dark: 'rgba(244, 114, 182, 0.35)' },
}

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'
const QURAN_TEXT_FONT = 'var(--font-quran), "Amiri Quran", "Scheherazade New", serif'

// Space between words, in em: the widest line sets the size using MIN_GAP_EM;
// any other line that would need gaps wider than MAX_GAP_EM to reach the full
// width is centred at CENTRED_GAP_EM instead of being stretched apart.
const MIN_GAP_EM = 0.16
const MAX_GAP_EM = 0.38
const CENTRED_GAP_EM = 0.24

export function MushafPage({ page, annotations, selectedWordIds, selectionPending = false, dark = false, script = 'madinah', onSelectWord }: MushafPageProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(26)
  const [centred, setCentred] = useState<Set<number>>(new Set())
  const [bands, setBands] = useState<Band[]>([])
  const [highlightBands, setHighlightBands] = useState<(Band & { color: string })[]>([])
  const mode = renderModeFor(script, page.fontsReady === true)
  // Each mode's font for a line of words; QCF glyphs set their own per-word font.
  const lineFont = mode === 'qcf' ? undefined : mode === 'indopak' ? `${INDOPAK_FAMILY}, "Amiri Quran", serif` : QURAN_TEXT_FONT
  const noteIcons = useMemo(() => noteIconWordIds(annotations), [annotations])
  const orderedIds = useMemo(() => flattenWords(page).map((w) => w.id), [page])
  // Each word's highlight colour (the first one, if several people highlighted it).
  const highlightColors = useMemo(() => {
    const colors = new Map<string, string>()
    for (const a of annotations) {
      if (a.kind === 'highlight' && a.color && a.wordRef && !colors.has(a.wordRef)) colors.set(a.wordRef, a.color)
    }
    return colors
  }, [annotations])

  // The selection is painted by the page, not by each word: one band per line
  // spanning the selected words and the gaps between them, so a phrase reads
  // as a single block (like selecting text) rather than separate boxes.
  const measureBands = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const origin = wrap.getBoundingClientRect()
    const boxOf = new Map<string, WordBox>()
    wrap.querySelectorAll<HTMLElement>('[data-word-id]').forEach((el) => {
      const id = el.dataset.wordId!
      if (!selectedWordIds.has(id) && !highlightColors.has(id)) return
      const line = Number(el.closest<HTMLElement>('[data-text-line]')?.dataset.textLine)
      const r = el.getBoundingClientRect()
      boxOf.set(id, { line, left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top })
    })

    setBands(selectionBands([...selectedWordIds].flatMap((id) => boxOf.get(id) ?? [])))
    // Consecutive words with the same colour share one block, the same way the selection does.
    setHighlightBands(
      highlightRuns(orderedIds, highlightColors).flatMap((run) =>
        selectionBands(run.ids.flatMap((id) => boxOf.get(id) ?? [])).map((band) => ({ ...band, color: run.color }))
      )
    )
  }, [selectedWordIds, highlightColors, orderedIds])

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
  }, [fit, page, mode])

  // Re-measure after anything that moves words: the selection itself, a new
  // font size, a line switching between centred and justified, or a new page.
  useLayoutEffect(() => {
    measureBands()
  }, [measureBands, fontSize, centred, page, mode])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(() => {
      fit()
      measureBands()
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [fit, measureBands])

  return (
    <div
      dir="rtl"
      lang="ar"
      className={`rounded-3xl border-2 p-2 shadow-card sm:p-3 ${dark ? 'border-amber-500/40 bg-[#17140f]' : 'border-amber-700/40 bg-[#fffdf6]'}`}
    >
      <div className={`rounded-2xl border px-3 py-4 sm:px-6 ${dark ? 'border-amber-500/25' : 'border-amber-700/25'}`}>
        {page.surahs?.length ? (
          <div
            className={`mb-3 flex items-center justify-between border-b pb-2 text-sm ${dark ? 'border-amber-500/25 text-amber-200' : 'border-amber-700/20 text-amber-900'}`}
            style={{ fontFamily: QURAN_TEXT_FONT }}
          >
            <span>{page.surahs.map((s) => `سُورَةُ ${s.arabic}`).join(' · ')}</span>
            <span dir="ltr" className={`font-sans text-xs ${dark ? 'text-amber-300/80' : 'text-amber-800/70'}`}>
              {page.surahs.map((s) => s.english).join(' · ')}
            </span>
          </div>
        ) : null}
        <div ref={wrapRef} style={{ fontSize, lineHeight: 2.05 }} className={`relative isolate ${dark ? 'text-stone-100' : 'text-slate-900'}`}>
          {highlightBands.map((band, i) => (
            <div
              key={`${band.color}-${band.line}-${i}`}
              aria-hidden="true"
              className="pointer-events-none absolute z-0 rounded-md"
              style={{
                left: band.left - 2,
                top: band.top + 2,
                width: band.width + 4,
                height: band.height - 4,
                backgroundColor: (HIGHLIGHT_FILL[band.color] ?? HIGHLIGHT_FILL.yellow)[dark ? 'dark' : 'light'],
              }}
            />
          ))}
          {bands.map((band) => (
            <div
              key={band.line}
              aria-hidden="true"
              className="pointer-events-none absolute z-0 rounded-md"
              style={{
                left: band.left - 3,
                top: band.top + 1,
                width: band.width + 6,
                height: band.height - 2,
                backgroundColor: dark ? 'rgba(56, 189, 248, 0.32)' : 'rgba(125, 211, 252, 0.55)',
                outline: `2px ${selectionPending ? 'dashed' : 'solid'} ${dark ? '#7dd3fc' : '#0284c7'}`,
              }}
            />
          ))}
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
                className={`relative z-[1] flex flex-nowrap items-center ${centred.has(line.lineNumber) ? 'justify-center' : 'justify-between'}`}
                style={{ gap: centred.has(line.lineNumber) ? `${CENTRED_GAP_EM}em` : undefined, fontFamily: lineFont }}
              >
                {line.words.map((word) => (
                  <MushafWord
                    key={word.id}
                    word={word}
                    annotations={annotations.filter((a) => annotationCoversWord(a, word.id, page))}
                    selected={selectedWordIds.has(word.id)}
                    showNoteIcon={noteIcons.has(word.id)}
                    mode={mode}
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
