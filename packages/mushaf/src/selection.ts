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
  /** The words of this verse the mark applies to, in reading order. */
  words: MushafWord[]
  createdAt: string
}

/** One verse's marks, shown as a single summary card: every marked word in it and every mark on them. */
export interface MarkBlock {
  /** `surah:ayah`. */
  key: string
  surah: number
  ayah: number
  /** The verse's marked words, in reading order. */
  words: MushafWord[]
  items: MarkItem[]
}

function itemKey(a: MushafAnnotation): string {
  if (a.kind === 'highlight') return `h:${a.authorId}:${a.color}`
  if (a.kind === 'error') return `e:${a.authorId}:${a.errorType}`
  return `n:${a.id}`
}

/**
 * Groups the page's marks by verse: one summary block per verse holding any
 * mark, listing each mark (a highlight colour, an error type, a comment) with
 * the words of that verse it applies to. A comment spanning several verses
 * goes with the first of them on this page, so it isn't repeated.
 */
export function buildMarkBlocks(page: MushafPageData, annotations: MushafAnnotation[]): MarkBlock[] {
  const blocks = new Map<string, { block: MarkBlock; byKey: Map<string, MarkItem>; wordIds: Set<string> }>()
  const noteVerse = new Map<string, string>()

  for (const word of flattenWords(page)) {
    const verse = `${word.surah}:${word.ayah}`
    for (const a of annotations) {
      if (!a.wordRef || !annotationCoversWord(a, word.id, page)) continue
      if (a.kind === 'note') {
        if (!noteVerse.has(a.id)) noteVerse.set(a.id, verse)
        if (noteVerse.get(a.id) !== verse) continue
      }

      let entry = blocks.get(verse)
      if (!entry) {
        entry = { block: { key: verse, surah: word.surah, ayah: word.ayah, words: [], items: [] }, byKey: new Map(), wordIds: new Set() }
        blocks.set(verse, entry)
      }
      if (!entry.wordIds.has(word.id)) {
        entry.wordIds.add(word.id)
        entry.block.words.push(word)
      }

      const key = itemKey(a)
      let item = entry.byKey.get(key)
      if (!item) {
        item = { kind: a.kind, authorId: a.authorId, color: a.color, errorType: a.errorType, noteText: a.noteText, annotationIds: [], words: [], createdAt: a.createdAt }
        entry.byKey.set(key, item)
        entry.block.items.push(item)
      }
      // A highlight/error is one row per word; a note is one row for its whole range.
      if (!item.annotationIds.includes(a.id)) item.annotationIds.push(a.id)
      if (!item.words.some((w) => w.id === word.id)) item.words.push(word)
    }
  }

  return [...blocks.values()].map((entry) => entry.block)
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

export interface VerseOnPage {
  surah: number
  ayah: number
  /** The verse's words on this page, in reading order (its end marker included when it's here). */
  words: MushafWord[]
  /** The verse began on the previous page. */
  startsBefore: boolean
  /** The verse carries on onto the next page. */
  continuesAfter: boolean
}

/**
 * The whole verse(s) a set of marked words belongs to, as found on this page,
 * so a summary card can show the marked words in context. A verse running
 * across two pages is flagged so the card can show it's cut.
 */
export function versesOfWords(page: MushafPageData, marked: MushafWord[]): VerseOnPage[] {
  const all = flattenWords(page)
  const keys = [...new Set(marked.map((w) => `${w.surah}:${w.ayah}`))]
  return keys.map((key) => {
    const [surah, ayah] = key.split(':').map(Number)
    const words = all.filter((w) => w.surah === surah && w.ayah === ayah)
    return {
      surah,
      ayah,
      words,
      startsBefore: !words.some((w) => w.wordIndex === 1),
      continuesAfter: !words.some((w) => w.isMarker),
    }
  })
}
