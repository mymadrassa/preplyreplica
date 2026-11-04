import { unstable_cache } from 'next/cache'
import type { SurahMeta } from '@/lib/homework'

/**
 * The 114 surahs (transliterated name and ayah count), from the same public
 * Quran.com API the Mushaf uses. They never change, so they're cached for a
 * day on the server. Empty on failure: callers then show "Surah N".
 */
export const getSurahs = unstable_cache(
  async (): Promise<SurahMeta[]> => {
    try {
      const response = await fetch('https://api.quran.com/api/v4/chapters?language=en')
      if (!response.ok) return []
      const data = (await response.json()) as { chapters: { id: number; name_simple: string; verses_count: number }[] }
      return data.chapters.map((c) => ({ id: c.id, name: c.name_simple, verses: c.verses_count }))
    } catch {
      return []
    }
  },
  ['quran-surahs'],
  { revalidate: 86_400 }
)

/** The Mushaf (Madinah) page an ayah is on, for "Open in Mushaf" links; null if the lookup fails. */
export const getVersePage = unstable_cache(
  async (surah: number, ayah: number): Promise<number | null> => {
    try {
      const response = await fetch(`https://api.quran.com/api/v4/verses/by_key/${surah}:${ayah}`)
      if (!response.ok) return null
      const data = (await response.json()) as { verse?: { page_number?: number } }
      return data.verse?.page_number ?? null
    } catch {
      return null
    }
  },
  ['quran-verse-page'],
  { revalidate: false }
)
