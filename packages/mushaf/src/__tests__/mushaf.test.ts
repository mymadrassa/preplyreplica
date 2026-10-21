import { describe, expect, it } from 'vitest'
import { canDeleteAnnotation } from '../annotations'
import { clampPage, getFixturePage, getTotalPages, verseRefFromWordRef } from '../data'
import { pageFromQuranCom } from '../data/quranCom'
import { annotationCoversWord, buildMarkBlocks, commonValue, flattenWords, wordsBetween } from '../selection'
import { eraseFromStroke, simplifyPoints } from '../strokes'
import { authorLabel, capabilitiesFor } from '../permissions'
import { filterSurahs, surahListFromChapters } from '../surahSearch'
import type { MushafAnnotation } from '../types'

const apiVerses = [
  {
    verse_key: '1:1',
    words: [
      { position: 1, char_type_name: 'word', text_uthmani: 'بِسْمِ', line_number: 2 },
      { position: 2, char_type_name: 'word', text_uthmani: 'ٱللَّهِ', line_number: 2 },
      { position: 3, char_type_name: 'end', text_uthmani: '١', line_number: 3 },
    ],
  },
  {
    verse_key: '1:2',
    words: [{ position: 1, char_type_name: 'word', text_uthmani: 'ٱلْحَمْدُ', line_number: 3 }],
  },
]

describe('mushaf data', () => {
  it('has the offline fixture for page 1 with surah:ayah:word ids', () => {
    const ids = getFixturePage(1)!.lines.flatMap((l) => l.words.map((w) => w.id))
    expect(ids[0]).toBe('1:1:1')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('returns no fixture for other pages', () => {
    expect(getFixturePage(9999)).toBeNull()
  })

  it('clamps page numbers into 1..604', () => {
    expect(getTotalPages()).toBe(604)
    expect(clampPage(0)).toBe(1)
    expect(clampPage(Number.NaN)).toBe(1)
    expect(clampPage(9999)).toBe(604)
  })

  it('derives a verse ref from a word ref', () => {
    expect(verseRefFromWordRef('2:255:3')).toBe('2:255')
  })
})

describe('pageFromQuranCom', () => {
  it('groups words into lines in order and flags verse-end markers', () => {
    const page = pageFromQuranCom(1, apiVerses)
    expect(page.lines.map((l) => l.lineNumber)).toEqual([2, 3])
    expect(page.lines[0].words.map((w) => w.id)).toEqual(['1:1:1', '1:1:2'])
    expect(page.lines[1].words[0]).toMatchObject({ id: '1:1:3', isMarker: true })
    expect(page.lines[1].words[1].id).toBe('1:2:1')
  })
})

describe('pageFromQuranCom headers', () => {
  const verses = [{ verse_key: '2:1', words: [{ position: 1, char_type_name: 'word', text_uthmani: 'الم', line_number: 3 }] }]

  it('rebuilds the surah title and basmala lines above a surah that has its own basmala', () => {
    const page = pageFromQuranCom(2, verses, { 2: { name: 'البقرة', bismillahPre: true } })
    expect(page.lines.map((l) => [l.lineNumber, l.kind])).toEqual([[1, 'header'], [2, 'basmala'], [3, 'text']])
    expect(page.lines[0].surahName).toBe('البقرة')
  })

  it('adds only a title line when the surah has no separate basmala', () => {
    const page = pageFromQuranCom(2, verses, { 2: { name: 'التوبة', bismillahPre: false } })
    expect(page.lines.map((l) => l.kind)).toEqual(['header', 'text'])
    expect(page.lines[0].lineNumber).toBe(2)
  })

  it('adds no title lines when chapter names are unavailable', () => {
    expect(pageFromQuranCom(2, verses).lines.map((l) => l.kind)).toEqual(['text'])
  })
})

describe('selection', () => {
  const page = pageFromQuranCom(1, apiVerses)

  it('includes verse-end numbers as selectable words', () => {
    expect(flattenWords(page).map((w) => w.id)).toEqual(['1:1:1', '1:1:2', '1:1:3', '1:2:1'])
  })

  it('returns the inclusive range in reading order whichever end was clicked first', () => {
    expect(wordsBetween(page, '1:1:1', '1:2:1').map((w) => w.id)).toEqual(['1:1:1', '1:1:2', '1:1:3', '1:2:1'])
    expect(wordsBetween(page, '1:2:1', '1:1:2').map((w) => w.id)).toEqual(['1:1:2', '1:1:3', '1:2:1'])
  })

  it('merges contiguous words with identical marks into one summary block', () => {
    const base = { sessionId: 's', authorId: 'u', bookingId: null, endWordRef: null, noteText: null, verseRef: '1:1', createdAt: '' }
    const mark = (id: string, wordRef: string): MushafAnnotation => ({ ...base, id, kind: 'highlight', color: 'yellow', errorType: null, wordRef })
    const blocks = buildMarkBlocks(page, [mark('a', '1:1:1'), mark('b', '1:1:2'), mark('c', '1:2:1')])
    expect(blocks.map((b) => b.words.map((w) => w.id))).toEqual([['1:1:1', '1:1:2'], ['1:2:1']])
    expect(blocks[0].items).toHaveLength(1)
    expect(blocks[0].items[0].annotationIds).toEqual(['a', 'b'])
  })

  it('produces no block for unmarked words', () => {
    expect(buildMarkBlocks(page, [])).toEqual([])
  })

  it('lets a range note cover every word in it, but a word mark only its own word', () => {
    const base = { id: 'a', sessionId: 's', authorId: 'u', bookingId: null, color: null, errorType: null, verseRef: '1:1', createdAt: '' }
    const rangeNote: MushafAnnotation = { ...base, kind: 'note', wordRef: '1:1:1', endWordRef: '1:2:1', noteText: 'x' }
    const wordMark: MushafAnnotation = { ...base, kind: 'highlight', wordRef: '1:1:2', endWordRef: null, noteText: null }
    expect(annotationCoversWord(rangeNote, '1:1:2', page)).toBe(true)
    expect(annotationCoversWord(wordMark, '1:1:2', page)).toBe(true)
    expect(annotationCoversWord(wordMark, '1:1:1', page)).toBe(false)
  })

  it('finds a shared value only when every word agrees', () => {
    expect(commonValue(['red', 'red'])).toBe('red')
    expect(commonValue(['red', null])).toBeNull()
    expect(commonValue([])).toBeNull()
  })
})

describe('surah search', () => {
  const surahs = surahListFromChapters({
    1: { name: 'ٱلْفَاتِحَة', bismillahPre: false, simpleName: 'Al-Fatihah', startPage: 1 },
    2: { name: 'ٱلْبَقَرَة', bismillahPre: true, simpleName: 'Al-Baqarah', startPage: 2 },
    3: { name: 'آلِ عِمْرَان', bismillahPre: true, simpleName: "Ali 'Imran", startPage: 50 },
  })

  it('shows nothing until something is typed', () => {
    expect(filterSurahs(surahs, '')).toEqual([])
    expect(filterSurahs(surahs, '   ')).toEqual([])
  })

  it('matches English names regardless of case, hyphens or apostrophes', () => {
    expect(filterSurahs(surahs, 'baqara').map((s) => s.id)).toEqual([2])
    expect(filterSurahs(surahs, 'al-fat').map((s) => s.id)).toEqual([1])
    expect(filterSurahs(surahs, 'ali imran').map((s) => s.id)).toEqual([3])
  })

  it('matches Arabic names ignoring vowel marks and letter variants', () => {
    expect(filterSurahs(surahs, 'بقرة').map((s) => s.id)).toEqual([2])
    expect(filterSurahs(surahs, 'الفاتحه').map((s) => s.id)).toEqual([1])
    expect(filterSurahs(surahs, 'ال عمران').map((s) => s.id)).toEqual([3])
  })

  it('matches by surah number and carries the start page', () => {
    expect(filterSurahs(surahs, '3')).toEqual([expect.objectContaining({ id: 3, startPage: 50 })])
  })

  it('returns nothing for an unknown name', () => {
    expect(filterSurahs(surahs, 'zzz')).toEqual([])
  })
})

describe('canDeleteAnnotation', () => {
  it('allows only the author or an admin', () => {
    expect(canDeleteAnnotation({ authorId: 'teacher' }, 'teacher')).toBe(true)
    expect(canDeleteAnnotation({ authorId: 'teacher' }, 'student')).toBe(false)
    expect(canDeleteAnnotation({ authorId: 'teacher' }, 'student', true)).toBe(true)
  })
})

describe('simplifyPoints', () => {
  it('keeps endpoints and drops points that barely moved', () => {
    const points: [number, number][] = [[0, 0], [0.0001, 0], [0.0002, 0], [0.5, 0.5], [1, 1]]
    expect(simplifyPoints(points)).toEqual([[0, 0], [0.5, 0.5], [1, 1]])
  })

  it('leaves a two-point stroke alone', () => {
    expect(simplifyPoints([[0, 0], [1, 1]])).toEqual([[0, 0], [1, 1]])
  })
})

describe('eraseFromStroke', () => {
  const size = { width: 1000, height: 1000 }
  const line: [number, number][] = [[0, 0.5], [1, 0.5]]

  it('returns null when the eraser never touches the stroke', () => {
    expect(eraseFromStroke(line, [[0.5, 0.9]], size, 20)).toBeNull()
  })

  it('splits a stroke in two when the eraser crosses its middle', () => {
    const pieces = eraseFromStroke(line, [[0.5, 0.5]], size, 20)!
    expect(pieces).toHaveLength(2)
    expect(pieces[0][0][0]).toBe(0)
    expect(pieces[0].at(-1)![0]).toBeLessThan(0.5)
    expect(pieces[1][0][0]).toBeGreaterThan(0.5)
    expect(pieces[1].at(-1)![0]).toBe(1)
  })

  it('catches a fast sweep whose recorded points skip over the stroke', () => {
    const sweep: [number, number][] = [[0.5, 0.2], [0.5, 0.8]]
    expect(eraseFromStroke(line, sweep, size, 20)).toHaveLength(2)
  })

  it('leaves nothing when the eraser covers the whole stroke', () => {
    const short: [number, number][] = [[0.5, 0.5], [0.51, 0.5]]
    expect(eraseFromStroke(short, [[0.505, 0.5]], size, 30)).toEqual([])
  })

  it('keeps the eraser round on a wide, short surface', () => {
    const wide = { width: 2000, height: 500 }
    // 0.02 across is 40px wide but only 10px tall: a vertical offset of 0.04 (20px) is outside a 15px eraser.
    expect(eraseFromStroke([[0, 0.5], [1, 0.5]], [[0.5, 0.54]], wide, 15)).toBeNull()
  })
})

describe('role capabilities', () => {
  it('lets only the teacher and a personal-space owner turn the shared page', () => {
    expect(capabilitiesFor('teacher').controlsSharedPage).toBe(true)
    expect(capabilitiesFor('owner').controlsSharedPage).toBe(true)
    expect(capabilitiesFor('student').controlsSharedPage).toBe(false)
  })

  it('gives a student comments only, and the others every kind of mark', () => {
    expect(capabilitiesFor('student').markKinds).toEqual(['note'])
    expect(capabilitiesFor('teacher').markKinds).toEqual(['highlight', 'error', 'note'])
    expect(capabilitiesFor('owner').markKinds).toEqual(['highlight', 'error', 'note'])
  })

  it('offers the author filter only where there is another author', () => {
    expect(capabilitiesFor('teacher').canFilterByAuthor).toBe(true)
    expect(capabilitiesFor('student').canFilterByAuthor).toBe(true)
    expect(capabilitiesFor('owner').canFilterByAuthor).toBe(false)
  })

  it('names authors relative to the viewer', () => {
    expect(authorLabel('owner', 'me', null)).toBe('You')
    expect(authorLabel('teacher', 't1', 't1')).toBe('Teacher')
    expect(authorLabel('student', 's1', 't1')).toBe('Student')
  })
})
