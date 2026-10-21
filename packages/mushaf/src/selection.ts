import type { MushafAnnotation, MushafPageData, MushafWord } from './types'

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
