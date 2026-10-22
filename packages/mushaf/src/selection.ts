import type { MushafAnnotation, MushafPageData, MushafWord, SurahInfo } from './types'

/** Selectable words of a page in reading order. Verse-end numbers are selectable too. */
export function flattenWords(page: MushafPageData): MushafWord[] {
  return page.lines.flatMap((line) => line.words)
}

/** Every word from `a` to `b` inclusive, in reading order, whichever was clicked first. */
export function wordsBetween(page: MushafPageData, aId: string, bId: string): MushafWord[] {
  const words = flattenWords(page)
  const a = words.findIndex((w) => w.id === aId)
  const b = words.findIndex((w) => w.id === bId)
  if (a === -1 || b === -1) return []
  return words.slice(Math.min(a, b), Math.max(a, b) + 1)
}

/** Does this mark apply to `wordId`? Word marks match by id; a range note covers every word between its ends. */
export function annotationCoversWord(annotation: MushafAnnotation, wordId: string, page: MushafPageData): boolean {
  if (annotation.wordRef === wordId) return true
  if (!annotation.wordRef || !annotation.endWordRef) return false
  return wordsBetween(page, annotation.wordRef, annotation.endWordRef).some((w) => w.id === wordId)
}

/** The value all `values` agree on, or null if they differ or the list is empty. */
export function commonValue<T>(values: (T | null)[]): T | null {
  if (!values.length) return null
  const first = values[0]
  return values.every((v) => v === first) ? first : null
}

export interface MarkItem {
  kind: 'highlight' | 'error' | 'note'
  authorId: string
  color: MushafAnnotation['color']
  errorType: MushafAnnotation['errorType']
  noteText: string | null
  /** Every annotation row behind this item (one per word for highlights/errors). */
  annotationIds: string[]
  createdAt: string
}

/** A run of contiguous words carrying the same marks, shown as a single summary card. */
export interface MarkBlock {
  key: string
  words: MushafWord[]
  items: MarkItem[]
}

function itemKey(a: MushafAnnotation): string {
  if (a.kind === 'highlight') return `h:${a.authorId}:${a.color}`
  if (a.kind === 'error') return `e:${a.authorId}:${a.errorType}`
  return `n:${a.id}`
}

/**
 * Groups the page's marked words into summary blocks: consecutive words with
 * identical marks merge into one block, so a selected phrase reads as one card
 * instead of one per word. Words with no marks produce no block. Verse-level
 * notes (no word) are handled separately by the caller.
 */
export function buildMarkBlocks(page: MushafPageData, annotations: MushafAnnotation[]): MarkBlock[] {
  const blocks: MarkBlock[] = []
  let current: { signature: string; block: MarkBlock; byKey: Map<string, MarkItem> } | null = null

  for (const word of flattenWords(page)) {
    const covering = annotations.filter((a) => a.wordRef && annotationCoversWord(a, word.id, page))
    if (!covering.length) {
      current = null
      continue
    }

    const signature = covering.map(itemKey).sort().join('|')
    if (current && current.signature === signature) {
      current.block.words.push(word)
      // A highlight/error is one row per word; a note is one row for the whole range, so it is not repeated.
      for (const a of covering) if (a.kind !== 'note') current.byKey.get(itemKey(a))?.annotationIds.push(a.id)
      continue
    }

    const byKey = new Map<string, MarkItem>()
    for (const a of covering) {
      const key = itemKey(a)
      const existing = byKey.get(key)
      if (existing) {
        existing.annotationIds.push(a.id)
      } else {
        byKey.set(key, {
          kind: a.kind,
          authorId: a.authorId,
          color: a.color,
          errorType: a.errorType,
          noteText: a.noteText,
          annotationIds: [a.id],
          createdAt: a.createdAt,
        })
      }
    }
    const block: MarkBlock = { key: word.id, words: [word], items: [...byKey.values()] }
    blocks.push(block)
    current = { signature, block, byKey }
  }

  return blocks
}

/**
 * Words that carry a comment icon: one per comment, on the last word of its
 * range (like a footnote marker at the end of the sentence), not on every word
 * the comment covers. Verse-level comments (no word) get none.
 */
export function noteIconWordIds(annotations: MushafAnnotation[]): Set<string> {
  const ids = new Set<string>()
  for (const a of annotations) {
    if (a.kind !== 'note' || !a.wordRef) continue
    ids.add(a.endWordRef ?? a.wordRef)
  }
  return ids
}

/** The user's own comment covering exactly this selection, which the toolbar then edits in place. */
export function findEditableNote(
  annotations: MushafAnnotation[],
  userId: string,
  startId: string,
  endId: string
): MushafAnnotation | null {
  return (
    annotations.find(
      (a) => a.kind === 'note' && a.authorId === userId && a.wordRef === startId && (a.endWordRef ?? a.wordRef) === endId
    ) ?? null
  )
}

export interface WordBox {
  line: number
  left: number
  top: number
  right: number
  bottom: number
}

export interface Band {
  line: number
  left: number
  top: number
  width: number
  height: number
}

/** Merges the boxes of selected words into one rectangle per line, so a selection reads as a single block. */
export function selectionBands(boxes: WordBox[]): Band[] {
  const byLine = new Map<number, WordBox>()
  for (const box of boxes) {
    const merged = byLine.get(box.line)
    byLine.set(
      box.line,
      merged
        ? {
            line: box.line,
            left: Math.min(merged.left, box.left),
            top: Math.min(merged.top, box.top),
            right: Math.max(merged.right, box.right),
            bottom: Math.max(merged.bottom, box.bottom),
          }
        : { ...box }
    )
  }
  return [...byLine.values()]
    .sort((a, b) => a.line - b.line)
    .map((b) => ({ line: b.line, left: b.left, top: b.top, width: b.right - b.left, height: b.bottom - b.top }))
}

/**
 * Splits highlighted words into runs of consecutive words (in reading order)
 * sharing one colour, so each run can be painted as one block. A word with no
 * highlight, or a different colour, ends the run.
 */
export function highlightRuns(orderedIds: string[], colorOf: Map<string, string>): { color: string; ids: string[] }[] {
  const runs: { color: string; ids: string[] }[] = []
  let current: { color: string; ids: string[] } | null = null
  for (const id of orderedIds) {
    const color = colorOf.get(id)
    if (!color) {
      current = null
      continue
    }
    if (current && current.color === color) {
      current.ids.push(id)
    } else {
      current = { color, ids: [id] }
      runs.push(current)
    }
  }
  return runs
}

/**
 * Names where a selection sits, by surah and ayah, e.g. "Al-Baqarah · Ayah 5",
 * "Al-Baqarah · Ayat 5–7", or across surahs "Al-Fatihah 7 – Al-Baqarah 1".
 * Falls back to the surah number when names are unavailable.
 */
export function describeSelection(words: MushafWord[], surahs: SurahInfo[] = []): string {
  if (!words.length) return ''
  const name = (n: number) => surahs.find((s) => s.number === n)?.english ?? `Surah ${n}`
  const first = words[0]
  const last = words[words.length - 1]

  if (first.surah !== last.surah) return `${name(first.surah)} ${first.ayah} – ${name(last.surah)} ${last.ayah}`
  if (first.ayah === last.ayah) return `${name(first.surah)} · Ayah ${first.ayah}`
  return `${name(first.surah)} · Ayat ${first.ayah}–${last.ayah}`
}

/**
 * The comments that belong on this page. A verse can run across two pages, so
 * matching by verse would show a comment on both; instead a comment belongs to
 * the page holding its (first) word, and a verse-level comment (no word) to the
 * page where its verse starts.
 */
export function notesOnPage(page: MushafPageData, annotations: MushafAnnotation[]): MushafAnnotation[] {
  const words = flattenWords(page)
  const wordIds = new Set(words.map((w) => w.id))
  const versesStartingHere = new Set(words.filter((w) => w.wordIndex === 1).map((w) => `${w.surah}:${w.ayah}`))
  return annotations.filter(
    (a) => a.kind === 'note' && (a.wordRef ? wordIds.has(a.wordRef) : versesStartingHere.has(a.verseRef))
  )
}
