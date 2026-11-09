'use client'

import { useState } from 'react'
import { verseRefFromWordRef } from '../data'
import { commonValue } from '../selection'
import type { AnnotationKind, ErrorType, HighlightColor, MushafAnnotation, MushafWord } from '../types'
import type { NewAnnotation } from '../annotations'
import { HIGHLIGHT_SWATCH, Icon, type IconName } from './icons'

const COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink']

export const ERRORS: { value: ErrorType; label: string; hint: string; icon: IconName }[] = [
  { value: 'memorisation', label: 'Memorisation error', hint: 'Forgot or changed a word', icon: 'memorisation' },
  { value: 'tajwid', label: 'Tajwid error', hint: 'A recitation rule not applied', icon: 'tajwid' },
  { value: 'hesitation', label: 'Hesitation', hint: 'Stopped or repeated before getting it right', icon: 'hesitation' },
]

type Panel = 'highlight' | 'error' | 'note'

const PANEL_ICONS: Record<Panel, { icon: IconName; label: string }> = {
  highlight: { icon: 'highlighter', label: 'Highlight' },
  error: { icon: 'alert', label: 'Mark an error' },
  note: { icon: 'comment', label: 'Add a comment' },
}

interface AnnotationToolbarProps {
  /** The kinds of mark this user may add; one icon is shown for each. */
  markKinds: readonly AnnotationKind[]
  /** The selected words, in reading order. */
  words: MushafWord[]
  /** Where the selection sits, e.g. "Al-Baqarah · Ayat 5–7". */
  title: string
  /** Marks covering the selected words, so the current choice shows as selected. */
  existing: MushafAnnotation[]
  currentUserId: string
  onAdd: (annotations: NewAnnotation[]) => Promise<{ error: string | null }>
  onRemove: (annotationIds: string[]) => Promise<{ error: string | null }>
  onError: (message: string) => void
  /** Called once a mark has been applied, or the toolbar is dismissed. */
  onClose: () => void
  /** Your existing comment on exactly this selection: the comment field opens with it and saving replaces it. */
  editableNote?: { id: string; text: string } | null
  /** Shown instead of the icons when this user can't add any kind of mark. */
  readOnlyMessage?: string
}

// Floating toolbar next to the selection: one icon per kind of mark, each
// opening its own options. Marks apply to every selected word. In a shared
// Mushaf a student has none: the toolbar then says where to add their own.
export function AnnotationToolbar({ markKinds, words, title, existing, currentUserId, onAdd, onRemove, onError, onClose, editableNote = null, readOnlyMessage }: AnnotationToolbarProps) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const [errorListOpen, setErrorListOpen] = useState(true)
  const [busyError, setBusyError] = useState<ErrorType | null>(null)
  const [note, setNote] = useState(editableNote?.text ?? '')
  const panels = (['highlight', 'error', 'note'] as const).filter((kind) => markKinds.includes(kind))

  const first = words[0]
  const last = words[words.length - 1]
  const wordIds = new Set(words.map((w) => w.id))
  const mine = existing.filter((a) => a.authorId === currentUserId && a.wordRef && wordIds.has(a.wordRef))

  // What each selected word currently has from you, so a button shows as chosen only when it holds for the whole selection.
  const colorByWord = words.map((w) => mine.find((a) => a.kind === 'highlight' && a.wordRef === w.id)?.color ?? null)
  const currentColor = commonValue(colorByWord)
  // A word can carry several errors: each type is ticked when every selected word has it from you.
  const errorMarks = (type: ErrorType) => mine.filter((a) => a.kind === 'error' && a.errorType === type)
  const [ticked, setTicked] = useState<Set<ErrorType>>(
    () => new Set(ERRORS.map((e) => e.value).filter((type) => words.every((w) => errorMarks(type).some((a) => a.wordRef === w.id))))
  )

  async function replaceMarks(kind: 'highlight' | 'error', make: ((word: MushafWord) => NewAnnotation) | null) {
    const stale = mine.filter((a) => a.kind === kind).map((a) => a.id)
    if (stale.length) {
      const { error } = await onRemove(stale)
      if (error) return onError(error)
    }
    if (make) {
      const { error } = await onAdd(words.map(make))
      if (error) return onError(error)
    }
    onClose()
  }

  const base = (word: MushafWord) => ({ wordRef: word.id, endWordRef: null, verseRef: verseRefFromWordRef(word.id) })

  const chooseColor = (color: HighlightColor | null) =>
    replaceMarks('highlight', color ? (word) => ({ kind: 'highlight', color, errorType: null, noteText: null, ...base(word) }) : null)

  // Ticking an error adds it to every selected word that doesn't have it yet; unticking removes it. Other errors stay.
  async function toggleError(type: ErrorType) {
    setBusyError(type)
    const on = ticked.has(type)
    if (on) {
      const { error } = await onRemove(errorMarks(type).map((a) => a.id))
      if (error) onError(error)
    } else {
      const missing = words.filter((w) => !errorMarks(type).some((a) => a.wordRef === w.id))
      const { error } = await onAdd(missing.map((word) => ({ kind: 'error', color: null, errorType: type, noteText: null, ...base(word) })))
      if (error) onError(error)
    }
    setBusyError(null)
    setTicked((current) => {
      const next = new Set(current)
      if (on) next.delete(type)
      else next.add(type)
      return next
    })
  }
  const tickedLabel = ERRORS.filter((e) => ticked.has(e.value)).map((e) => e.label).join(', ')

  async function submitNote() {
    const text = note.trim()
    if (!text) return
    if (editableNote && text === editableNote.text.trim()) return onClose()
    // Editing your comment: the new text takes the old one's place.
    if (editableNote) {
      const { error } = await onRemove([editableNote.id])
      if (error) return onError(error)
    }
    const { error } = await onAdd([
      {
        kind: 'note',
        color: null,
        errorType: null,
        noteText: text,
        wordRef: first.id,
        endWordRef: words.length > 1 ? last.id : null,
        verseRef: verseRefFromWordRef(first.id),
      },
    ])
    if (error) onError(error)
    else onClose()
  }


  return (
    <div
      role="dialog"
      aria-label={`Marks for ${title}`}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
      className="w-72 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-lift"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600">{title}</p>
        <div className="flex items-center gap-1">
          {panels.map((name) => (
            <button
              key={name}
              type="button"
              title={PANEL_ICONS[name].label}
              aria-label={PANEL_ICONS[name].label}
              aria-pressed={panel === name}
              onClick={() => setPanel((current) => (current === name ? null : name))}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                panel === name ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon name={PANEL_ICONS[name].icon} />
            </button>
          ))}
          <button type="button" title="Close" aria-label="Close" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <Icon name="close" />
          </button>
        </div>
      </div>

      {!panels.length && readOnlyMessage ? <p className="text-xs text-slate-600">{readOnlyMessage}</p> : null}

      {panel === 'highlight' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="No colour"
            aria-label="No colour"
            onClick={() => chooseColor(null)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <Icon name="ban" className="h-4 w-4" />
          </button>
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={`Highlight ${color}`}
              aria-pressed={currentColor === color}
              onClick={() => chooseColor(color)}
              className={`h-7 w-7 rounded-full border ${HIGHLIGHT_SWATCH[color]} ${currentColor === color ? 'border-slate-900 ring-2 ring-slate-900' : 'border-slate-200'}`}
            />
          ))}
        </div>
      ) : null}

      {panel === 'error' ? (
        <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={errorListOpen}
            onClick={() => setErrorListOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <span className="truncate">{tickedLabel || 'Choose the errors…'}</span>
            <Icon name="chevron-down" className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${errorListOpen ? 'rotate-180' : ''}`} />
          </button>
          {errorListOpen ? (
            <ul role="listbox" aria-multiselectable="true" aria-label="Errors" className="mt-1 space-y-0.5 rounded-xl border border-slate-200 bg-white p-1">
              {ERRORS.map((error) => {
                const on = ticked.has(error.value)
                return (
                  <li key={error.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      disabled={busyError !== null}
                      onClick={() => toggleError(error.value)}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors disabled:opacity-60 ${on ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 bg-white'}`}
                        aria-hidden="true"
                      >
                        {on ? <Icon name="check" className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800">{error.label}</span>
                        <span className="block text-xs text-slate-500">{error.hint}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
          <p className="mt-1 text-[11px] text-slate-400">Tick as many as apply; each one is saved straight away.</p>
        </div>
      ) : null}

      {panel === 'note' ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            submitNote()
          }}
        >
          <input
            autoFocus
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="Write a comment…"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            title="Add comment"
            aria-label="Add comment"
            disabled={!note.trim()}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Icon name="send" />
          </button>
        </form>
      ) : null}
    </div>
  )
}
