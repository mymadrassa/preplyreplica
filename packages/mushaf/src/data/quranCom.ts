import type { MushafLine, MushafPageData, MushafWord } from '../types'

// Quran.com public API v4 (CORS-open). `mushaf=2` is the 15-line Madinah
// layout, so `line_number` per word reproduces the printed page.
const API = 'https://api.quran.com/api/v4'

interface ApiWord {
  position: number
  char_type_name: 'word' | 'end' | string
  text_uthmani?: string
  text?: string
  code_v1?: string
  page_number?: number
  line_number: number
}

interface ApiVerse {
  verse_key: string
  words: ApiWord[]
}

export interface ChapterInfo {
  name: string
  /** Whether the surah opens with its own basmala line (false for Al-Fatiha, where it is verse 1, and At-Tawba). */
  bismillahPre: boolean
  /** Transliterated English name, e.g. "Al-Baqarah". */
  simpleName?: string
  /** First page of the surah in the Madinah Mushaf. */
  startPage?: number
}

export type Chapters = Record<number, ChapterInfo>

// The printed page reserves a title line (and, for most surahs, a basmala
// line) above a surah's first verse. The API leaves those lines out, so they
// are rebuilt from where each surah's first word sits.
export function pageFromQuranCom(page: number, verses: ApiVerse[], chapters?: Chapters): MushafPageData {
  const byLine = new Map<number, MushafWord[]>()
  const surahStartLine = new Map<number, number>()

  for (const verse of verses) {
    const [surah, ayah] = verse.verse_key.split(':').map(Number)
    for (const word of verse.words) {
      const isMarker = word.char_type_name === 'end'
      const entry: MushafWord = {
        id: `${surah}:${ayah}:${word.position}`,
        surah,
        ayah,
        wordIndex: word.position,
        text: word.text_uthmani ?? word.text ?? '',
        ...(isMarker ? { isMarker: true } : {}),
        ...(word.code_v1 ? { glyph: word.code_v1 } : {}),
        ...(word.page_number ? { fontPage: word.page_number } : {}),
      }
      const line = byLine.get(word.line_number) ?? []
      line.push(entry)
      byLine.set(word.line_number, line)
      if (ayah === 1 && word.position === 1) surahStartLine.set(surah, word.line_number)
    }
  }

  const lines: MushafLine[] = [...byLine.entries()].map(([lineNumber, words]) => ({ lineNumber, kind: 'text', words }))

  if (chapters) {
    for (const [surah, firstLine] of surahStartLine) {
      const chapter = chapters[surah]
      if (!chapter) continue
      const basmalaLine = chapter.bismillahPre ? firstLine - 1 : null
      const headerLine = (basmalaLine ?? firstLine) - 1
      if (headerLine >= 1) lines.push({ lineNumber: headerLine, kind: 'header', words: [], surahName: chapter.name })
      if (basmalaLine !== null && basmalaLine >= 1) lines.push({ lineNumber: basmalaLine, kind: 'basmala', words: [] })
    }
  }

  lines.sort((a, b) => a.lineNumber - b.lineNumber)
  return { page, lines }
}

let chaptersPromise: Promise<Chapters | undefined> | null = null

export function fetchChapters(): Promise<Chapters | undefined> {
  if (!chaptersPromise) {
    chaptersPromise = fetch(`${API}/chapters?language=ar`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: { chapters: { id: number; name_arabic: string; name_simple: string; bismillah_pre: boolean; pages: number[] }[] }) =>
        Object.fromEntries(
          data.chapters.map((c) => [
            c.id,
            { name: c.name_arabic, bismillahPre: c.bismillah_pre, simpleName: c.name_simple, startPage: c.pages?.[0] },
          ])
        )
      )
      .catch(() => {
        chaptersPromise = null
        return undefined
      })
  }
  return chaptersPromise
}

export async function fetchQuranComPage(page: number, signal?: AbortSignal): Promise<MushafPageData> {
  const url = `${API}/verses/by_page/${page}?words=true&word_fields=code_v1,text_uthmani,line_number,page_number&per_page=50&mushaf=2`
  const [response, chapters] = await Promise.all([fetch(url, { signal }), fetchChapters()])
  if (!response.ok) throw new Error(`Quran.com responded ${response.status}`)
  const data = (await response.json()) as { verses: ApiVerse[] }
  return pageFromQuranCom(page, data.verses, chapters)
}
