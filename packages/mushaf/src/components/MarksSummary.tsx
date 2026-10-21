'use client'

import { useState } from 'react'
import { canDeleteAnnotation } from '../annotations'
import type { MarkBlock, MarkItem } from '../selection'
import type { MushafAnnotation } from '../types'
import { HIGHLIGHT_SWATCH, Icon, type IconName } from './icons'

interface MarksSummaryProps {
  pageNumber: number
  /** Runs of contiguous marked words, in reading order. */
  blocks: MarkBlock[]
  /** Verse-level comments left without a word (older notes). */
  verseNotes: MushafAnnotation[]
  selectedWordIds: Set<string>
  /** Names a mark's author for this viewer ("You", "Teacher", "Student"). */
  authorLabel: (authorId: string) => string
  currentUserId: string
  onDelete: (annotationIds: string[]) => void
  /** Selects a card's words on the page. */
  onFocusBlock: (block: MarkBlock) => void
  onClose: () => void
}

const ERROR_ICON: Record<string, { icon: IconName; label: string }> = {
  memorisation: { icon: 'memorisation', label: 'Memorisation error' },
  tajwid: { icon: 'tajwid', label: 'Tajwid error' },
  hesitation: { icon: 'hesitation', label: 'Hesitation' },
}

function phrase(block: MarkBlock): string {
  return block.words.map((w) => (w.isMarker ? `﴿${w.text}﴾` : w.text)).join(' ')
}

// Left-hand stack of cards, one per marked phrase: the words with their
// highlight, error and comments together. Cards appear when something is
// marked, not merely selected.
export function MarksSummary({ pageNumber, blocks, verseNotes, selectedWordIds, authorLabel, currentUserId, onDelete, onFocusBlock, onClose }: MarksSummaryProps) {
  const [confirmingClear, setConfirmingClear] = useState(false)
  const author = authorLabel

  // Everything on this page that the current user is allowed to delete.
  const deletableIds = [
    ...blocks.flatMap((block) => block.items.filter((item) => canDeleteAnnotation({ authorId: item.authorId }, currentUserId)).flatMap((item) => item.annotationIds)),
    ...verseNotes.filter((note) => canDeleteAnnotation(note, currentUserId)).map((note) => note.id),
  ]
  const cardCount = blocks.length + verseNotes.length

  function removeButton(authorId: string, ids: string[]) {
    if (!canDeleteAnnotation({ authorId }, currentUserId)) return null
    return (
      <button
        type="button"
        title="Remove"
        aria-label="Remove"
        onClick={() => onDelete(ids)}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
      </button>
    )
  }

  function renderMark(item: MarkItem, index: number) {
    if (item.kind === 'highlight') {
      return (
        <span key={index} title={`Highlight ${item.color} · ${author(item.authorId)}`}>
          <span className={`block h-5 w-5 rounded-full border border-slate-200 ${HIGHLIGHT_SWATCH[item.color!]}`} />
        </span>
      )
    }
    const meta = ERROR_ICON[item.errorType!]
    return (
      <span key={index} className="text-red-600" title={`${meta.label} · ${author(item.authorId)}`}>
        <Icon name={meta.icon} className="h-5 w-5" />
      </span>
    )
  }

  // One trash per card removes everything on it -- highlight, error and
  // comments across the whole phrase -- limited to what the current user may delete.
  function removeCard(block: MarkBlock) {
    const mine = block.items.filter((item) => canDeleteAnnotation({ authorId: item.authorId }, currentUserId))
    if (!mine.length) return null
    return (
      <button
        type="button"
        title="Remove everything on this card"
        aria-label="Remove everything on this card"
        onClick={() => onDelete(mine.flatMap((item) => item.annotationIds))}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
      >
        <Icon name="trash" className="h-4 w-4" />
      </button>
    )
  }

  return (
    <aside data-mushaf-keep aria-label="Revision history" className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Revision history</p>
        <div className="flex items-center gap-1">
          {cardCount > 1 ? (
            <button
              type="button"
              title="Delete all marks on this page"
              aria-label="Delete all marks on this page"
              disabled={!deletableIds.length}
              onClick={() => setConfirmingClear(true)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Icon name="trash" />
            </button>
          ) : null}
          <button type="button" title="Hide summary" aria-label="Hide summary" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <Icon name="chevron-left" />
          </button>
        </div>
      </div>

      {confirmingClear ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(event) => event.key === 'Escape' && setConfirmingClear(false)}>
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setConfirmingClear(false)} />
          <div role="alertdialog" aria-modal="true" aria-labelledby="clear-marks-title" className="relative z-10 w-full max-w-sm space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Icon name="alert" className="h-5 w-5" />
              </span>
              <div>
                <h2 id="clear-marks-title" className="text-base font-semibold text-slate-900">
                  Delete all marks on page {pageNumber}?
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  This removes {cardCount === 1 ? 'the card' : `all ${cardCount} cards`} and every highlight, error and comment you wrote on this page. It can&apos;t be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmingClear(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(deletableIds)
                  setConfirmingClear(false)
                }}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                <Icon name="trash" /> Delete all
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
        {blocks.map((block) => {
          const isSelected = block.words.some((w) => selectedWordIds.has(w.id))
          const marks = block.items.filter((i) => i.kind !== 'note')
          const notes = block.items.filter((i) => i.kind === 'note')
          return (
            <li key={block.key} className={`space-y-2 rounded-xl border p-3 ${isSelected ? 'border-sky-400 bg-sky-50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-start gap-2">
                {removeCard(block)}
                <button type="button" onClick={() => onFocusBlock(block)} className="block min-w-0 flex-1 text-right" title="Show on the page">
                  <span dir="rtl" lang="ar" className="block break-words text-xl leading-loose" style={{ fontFamily: 'var(--font-quran), "Amiri Quran", serif' }}>
                    {phrase(block)}
                  </span>
                </button>
              </div>

              {marks.length ? <div className="flex flex-wrap items-center gap-2">{marks.map(renderMark)}</div> : null}

              {notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-white px-2.5 py-2 text-sm">
                  <Icon name="comment" className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-slate-800">{note.noteText}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{author(note.authorId)}</p>
                  </div>
                </div>
              ))}
            </li>
          )
        })}

        {verseNotes.map((note) => (
          <li key={note.id} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
            <Icon name="comment" className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-slate-800">{note.noteText}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {author(note.authorId)} · verse {note.verseRef}
              </p>
            </div>
            {removeButton(note.authorId, [note.id])}
          </li>
        ))}
      </ul>
    </aside>
  )
}
