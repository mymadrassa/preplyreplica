'use client'

import { useState } from 'react'
import { canDeleteAnnotation } from '../annotations'
import { versesOfWords, type MarkBlock, type MarkItem } from '../selection'
import type { MushafAnnotation, MushafPageData, MushafWord } from '../types'
import { HIGHLIGHT_SWATCH, Icon, type IconName } from './icons'

interface MarksSummaryProps {
  pageNumber: number
  /** The page, so each card can show the whole verse its words belong to. */
  page: MushafPageData
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

const QURAN_FONT = 'var(--font-quran), "Amiri Quran", serif'

/** The card's verse in full (as far as this page goes), with its marked words emphasised. */
function VerseText({ page, block }: { page: MushafPageData; block: MarkBlock }) {
  const marked = new Set(block.words.map((w) => w.id))
  const [verse] = versesOfWords(page, block.words)
  if (!verse) return null
  return (
    <p dir="rtl" lang="ar" className="break-words text-lg leading-loose text-slate-500" style={{ fontFamily: QURAN_FONT }}>
      {verse.startsBefore ? '… ' : null}
      {verse.words.map((w, i) => (
        <span key={w.id}>
          {i > 0 ? ' ' : null}
          <span className={marked.has(w.id) ? 'rounded bg-amber-100 px-0.5 font-semibold text-slate-900' : ''}>{w.isMarker ? `﴿${w.text}﴾` : w.text}</span>
        </span>
      ))}
      {verse.continuesAfter ? ' …' : null}
    </p>
  )
}

/** Words as a short Arabic snippet. */
function wordsSnippet(words: MushafWord[]): string {
  return words.map((w) => (w.isMarker ? `﴿${w.text}﴾` : w.text)).join(' ')
}

/** A card's marks grouped by the words they apply to: the same word(s) once, with all their marks together. */
function groupByWords(items: MarkItem[]): { key: string; words: MushafWord[]; items: MarkItem[] }[] {
  const groups = new Map<string, { key: string; words: MushafWord[]; items: MarkItem[] }>()
  for (const item of items) {
    const key = item.words.map((w) => w.id).join(',')
    const group = groups.get(key) ?? { key, words: item.words, items: [] }
    group.items.push(item)
    groups.set(key, group)
  }
  return [...groups.values()]
}

// Left-hand stack of cards, one per verse with marks: the verse in full, then
// each highlight, error and comment on it with the words it applies to. Cards appear when something is
// marked, not merely selected.
export function MarksSummary({ pageNumber, page, blocks, verseNotes, selectedWordIds, authorLabel, currentUserId, onDelete, onFocusBlock, onClose }: MarksSummaryProps) {
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

  // Removes one mark (e.g. just the tajwid error), when the viewer may delete it.
  function chipRemove(item: MarkItem) {
    if (!canDeleteAnnotation({ authorId: item.authorId }, currentUserId)) return null
    return (
      <button
        type="button"
        title="Remove this mark"
        aria-label="Remove this mark"
        onClick={() => onDelete(item.annotationIds)}
        className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        <Icon name="close" className="h-3 w-3" />
      </button>
    )
  }

  function renderMark(item: MarkItem, index: number) {
    if (item.kind === 'highlight') {
      return (
        <span key={index} className="inline-flex items-center gap-1 text-xs font-medium text-slate-700" title={`Highlight ${item.color} · ${author(item.authorId)}`}>
          <span className={`block h-4 w-4 rounded-full border border-slate-200 ${HIGHLIGHT_SWATCH[item.color!]}`} /> Highlight
        </span>
      )
    }
    const meta = ERROR_ICON[item.errorType!]
    return (
      <span key={index} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700" title={`${meta.label} · ${author(item.authorId)}`}>
        <Icon name={meta.icon} className="h-3.5 w-3.5" /> {meta.label}
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
    <aside data-mushaf-keep aria-label="Revision history" className="flex min-h-0 max-h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
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

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
        {blocks.map((block) => {
          const isSelected = block.words.some((w) => selectedWordIds.has(w.id))
          const reference = `${page.surahs?.find((x) => x.number === block.surah)?.english ?? `Surah ${block.surah}`} · Ayah ${block.ayah}`
          return (
            <li key={block.key} className={`space-y-2 rounded-xl border p-3 ${isSelected ? 'border-sky-400 bg-sky-50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{reference}</p>
                {removeCard(block)}
              </div>
              <button type="button" onClick={() => onFocusBlock(block)} className="block w-full text-right" title="Show on the page">
                <VerseText page={page} block={block} />
              </button>

              <ul className="space-y-1.5">
                {groupByWords(block.items).map((group) => {
                  const marks = group.items.filter((item) => item.kind !== 'note')
                  const notes = group.items.filter((item) => item.kind === 'note')
                  return (
                    <li key={group.key} className="space-y-1.5 rounded-lg bg-white px-2.5 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onFocusBlock({ ...block, words: group.words })}
                          dir="rtl"
                          lang="ar"
                          className="rounded px-1 text-base text-slate-900 hover:bg-slate-100"
                          style={{ fontFamily: QURAN_FONT }}
                          title="Show these words on the page"
                        >
                          {wordsSnippet(group.words)}
                        </button>
                        {marks.map((item, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5">
                            {renderMark(item, i)}
                            {chipRemove(item)}
                          </span>
                        ))}
                      </div>
                      {notes.map((note, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Icon name="comment" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-600" />
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-slate-800">{note.noteText}</p>
                            <p className="text-[11px] text-slate-400">{author(note.authorId)}</p>
                          </div>
                          {removeButton(note.authorId, note.annotationIds)}
                        </div>
                      ))}
                    </li>
                  )
                })}
              </ul>
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
