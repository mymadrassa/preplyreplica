import type { Chapters } from './data/quranCom'

export interface SurahEntry {
  id: number
  arabic: string
  english: string
  startPage: number
}

export function surahListFromChapters(chapters: Chapters): SurahEntry[] {
  return Object.entries(chapters)
    .map(([id, chapter]) => ({
      id: Number(id),
      arabic: chapter.name,
      english: chapter.simpleName ?? '',
      startPage: chapter.startPage ?? 1,
    }))
    .sort((a, b) => a.id - b.id)
}

// Arabic: drop vowel marks and tatweel, and fold the alef / yaa / taa-marbuta
// variants so "البقرة", "ٱلْبَقَرَةُ" and "البقره" all match.
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
}

// Latin: lower-case letters only, so "Al-Baqarah", "al baqarah" and "albaqarah" are the same.
export function normalizeLatin(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const ARABIC_LETTERS = /[؀-ۿ]/

/** Surahs matching `query` in Arabic or English (or by number). An empty query matches nothing. */
export function filterSurahs(surahs: SurahEntry[], query: string): SurahEntry[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  if (ARABIC_LETTERS.test(trimmed)) {
    const needle = normalizeArabic(trimmed)
    return surahs.filter((s) => normalizeArabic(s.arabic).includes(needle))
  }

  const needle = normalizeLatin(trimmed)
  if (!needle) return []
  return surahs.filter((s) => normalizeLatin(s.english).includes(needle) || String(s.id) === needle)
}
