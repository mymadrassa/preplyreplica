import { qcfFamily } from '../data/qcfFonts'
import { wordDisplay, type RenderMode } from '../script'
import type { ErrorType, MushafAnnotation, MushafWord as MushafWordData } from '../types'

// Highlights are painted by the page as blocks spanning consecutive words; a word only draws its error underline.
const ERROR_CLASSES: Record<ErrorType, string> = {
  memorisation: 'underline decoration-wavy decoration-red-500 decoration-2 underline-offset-[0.35em]',
  tajwid: 'underline decoration-wavy decoration-orange-500 decoration-2 underline-offset-[0.35em]',
  hesitation: 'underline decoration-dotted decoration-slate-600 decoration-2 underline-offset-[0.35em]',
}

interface MushafWordProps {
  word: MushafWordData
  /** Marks that apply to this word (its own marks plus range notes covering it). */
  annotations: MushafAnnotation[]
  /** Selected words skip the hover tint; the selection itself is drawn by the page as one block. */
  selected: boolean
  /** This word ends a comment, so it carries the comment icon (one icon per comment, not per word). */
  showNoteIcon?: boolean
  /** How words are drawn: Madinah page glyphs, IndoPak text, or plain text. */
  mode: RenderMode
  dark?: boolean
  onSelect: (word: MushafWordData, element: HTMLElement) => void
}

export function MushafWord({ word, annotations, selected, showNoteIcon = false, mode, dark = false, onSelect }: MushafWordProps) {
  const highlight = annotations.find((a) => a.kind === 'highlight' && a.color)
  const error = annotations.find((a) => a.kind === 'error' && a.errorType)
  const glyph = mode === 'qcf' && word.glyph

  const classes = [
    'relative inline-block shrink-0 cursor-pointer select-none whitespace-nowrap rounded-sm transition-colors',
    // Hover tint only on plain words, so it never paints over a highlight or the selection.
    !selected && !highlight ? (dark ? 'hover:bg-white/10' : 'hover:bg-amber-100/70') : '',
    error?.errorType ? (dark ? ERROR_CLASSES[error.errorType].replace('decoration-slate-600', 'decoration-slate-300') : ERROR_CLASSES[error.errorType]) : '',
    word.isMarker && !glyph ? (dark ? 'text-[0.75em] text-amber-300' : 'text-[0.75em] text-amber-800') : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      role="button"
      tabIndex={0}
      data-word-id={word.id}
      className={classes}
      style={glyph ? { fontFamily: `${qcfFamily(word.fontPage ?? 1)}, "Amiri Quran", serif` } : undefined}
      onClick={(e) => onSelect(word, e.currentTarget)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(word, e.currentTarget)}
    >
      {wordDisplay(word, mode)}
      {showNoteIcon ? (
        <svg viewBox="0 0 24 24" className={`absolute -top-1 left-0 h-[0.42em] w-[0.42em] ${dark ? 'text-sky-300' : 'text-brand-600'}`} fill="currentColor" role="img" aria-label="Has a note">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ) : null}
    </span>
  )
}
