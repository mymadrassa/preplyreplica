import type { MushafScript } from './script'
import type { MushafPageData } from './types'
import { FIXTURE_PAGES } from './data/fixturePages'
import { ensureIndopakFont } from './data/indopakFont'
import { ensureQcfFonts } from './data/qcfFonts'
import { fetchQuranComPage } from './data/quranCom'

export const TOTAL_PAGES = 604

export function getTotalPages(): number {
  return TOTAL_PAGES
}

export function clampPage(pageNumber: number): number {
  if (!Number.isFinite(pageNumber)) return 1
  return Math.min(Math.max(Math.trunc(pageNumber), 1), TOTAL_PAGES)
}

/** "1:7:3" -> "1:7" */
export function verseRefFromWordRef(wordRef: string): string {
  return wordRef.split(':').slice(0, 2).join(':')
}

/** Offline stand-in used only when the page can't be fetched (Al-Fatiha only). */
export function getFixturePage(pageNumber: number): MushafPageData | null {
  return FIXTURE_PAGES[pageNumber] ?? null
}

const cache = new Map<number, MushafPageData>()

/** The single place page content is loaded from — swap this to change data source without touching callers. */
export async function loadMushafPage(pageNumber: number, signal?: AbortSignal): Promise<MushafPageData | null> {
  const page = clampPage(pageNumber)
  const cached = cache.get(page)
  if (cached) return cached

  try {
    const loaded = await fetchQuranComPage(page, signal)
    cache.set(page, loaded)
    return loaded
  } catch {
    return getFixturePage(page)
  }
}

/** Loads the font(s) a script needs for this page; false means the page should fall back to plain text. */
export function loadScriptFonts(page: MushafPageData, script: MushafScript): Promise<boolean> {
  if (script === 'indopak') return ensureIndopakFont()
  const fontPages = page.lines.flatMap((line) => line.words.flatMap((w) => (w.glyph ? [w.fontPage ?? page.page] : [])))
  return fontPages.length ? ensureQcfFonts(fontPages) : Promise.resolve(false)
}
