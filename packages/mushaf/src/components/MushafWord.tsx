import { qcfFamily } from '../data/qcfFonts'
import type { ErrorType, HighlightColor, MushafAnnotation, MushafWord as MushafWordData } from '../types'

const HIGHLIGHT_CLASSES: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-200',
  green: 'bg-emerald-200',
  blue: 'bg-sky-200',
  pink: 'bg-pink-200',
}

const HIGHLIGHT_CLASSES_DARK: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-400/35',
  green: 'bg-emerald-400/35',
  blue: 'bg-sky-400/35',
  pink: 'bg-pink-400/35',
}

const ERROR_CLASSES: Record<ErrorType, string> = {
  memorisation: 'underline decoration-wavy decoration-red-500 decoration-2 underline-offset-[0.35em]',
  tajwid: 'underline decoration-wavy decoration-orange-500 decoration-2 underline-offset-[0.35em]',
  hesitation: 'underline decoration-dotted decoration-slate-600 decoration-2 underline-offset-[0.35em]',
}

interface MushafWordProps {
  word: MushafWordData
  /** Marks that apply to this word (its own marks plus range notes covering it). */
  annotations: MushafAnnotation[]
  selected: boolean
  /** The selection has a start but no end yet: the start word is outlined with a dashed line. */
  pending?: boolean
  /** Render the QCF glyph (the printed-Mushaf look); otherwise plain text. */
  useGlyphs: boolean
  dark?: boolean
  onSelect: (word: MushafWordData, element: HTMLElement) => void
}

export function MushafWord({ word, annotations, selected, pending = false, useGlyphs, dark = false, onSelect }: MushafWordProps) {
  const highlight = annotations.find((a) => a.kind === 'highlight' && a.color)
  const error = annotations.find((a) => a.kind === 'error' && a.errorType)
  const hasNote = annotations.some((a) => a.kind === 'note')
  const glyph = useGlyphs && word.glyph

  const classes = [
    'relative inline-block shrink-0 cursor-pointer select-none whitespace-nowrap rounded-sm transition-colors',
    // Hover tint only on plain words, so it never paints over a highlight or the selection.
    !selected && !highlight ? (dark ? 'hover:bg-white/10' : 'hover:bg-amber-100/70') : '',
    highlight?.color ? (dark ? HIGHLIGHT_CLASSES_DARK : HIGHLIGHT_CLASSES)[highlight.color] : '',
    error?.errorType ? (dark ? ERROR_CLASSES[error.errorType].replace('decoration-slate-600', 'decoration-slate-300') : ERROR_CLASSES[error.errorType]) : '',
    word.isMarker && !glyph ? (dark ? 'text-[0.7em] text-amber-300' : 'text-[0.7em] text-amber-800') : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      role="button"
      tabIndex={0}
      data-word-id={word.id}
      className={classes}
      style={{
        ...(glyph ? { fontFamily: `${qcfFamily(word.fontPage ?? 1)}, "Amiri Quran", serif` } : {}),
        // Inline so no hover or highlight class can hide the selection, in either theme.
        ...(selected
          ? {
              backgroundColor: dark ? 'rgba(56, 189, 248, 0.45)' : '#bae6fd',
              outline: `2px ${pending ? 'dashed' : 'solid'} ${dark ? '#7dd3fc' : '#0284c7'}`,
              outlineOffset: '1px',
            }
          : {}),
      }}
      onClick={(e) => onSelect(word, e.currentTarget)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(word, e.currentTarget)}
    >
      {glyph || word.text}
      {hasNote ? (
        <svg viewBox="0 0 24 24" className={`absolute -top-1 left-0 h-[0.42em] w-[0.42em] ${dark ? 'text-sky-300' : 'text-brand-600'}`} fill="currentColor" role="img" aria-label="Has a note">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ) : null}
    </span>
  )
}
