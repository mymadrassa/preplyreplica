import type { MushafWord } from './types'

/** The written style of the Quran text. Both use the same 15-line page layout and word numbering. */
export type MushafScript = 'madinah' | 'indopak'

export const MUSHAF_SCRIPTS: { value: MushafScript; label: string }[] = [
  { value: 'madinah', label: 'Madinah (Uthmani)' },
  { value: 'indopak', label: 'IndoPak' },
]

/**
 * How words are actually drawn:
 * - qcf:     the Madinah page glyph fonts (the printed-Mushaf look)
 * - indopak: IndoPak spelling in the IndoPak font
 * - text:    plain Uthmani text, used until (or if) the script's font can't load
 */
export type RenderMode = 'qcf' | 'indopak' | 'text'

export function renderModeFor(script: MushafScript, fontsReady: boolean): RenderMode {
  if (!fontsReady) return 'text'
  return script === 'indopak' ? 'indopak' : 'qcf'
}

/** What to show for a word in a given mode. Verse-end numbers get ornate brackets outside the glyph font. */
export function wordDisplay(word: MushafWord, mode: RenderMode): string {
  if (mode === 'qcf' && word.glyph) return word.glyph
  if (word.isMarker) return mode === 'indopak' ? `﴿${word.text}﴾` : word.text
  if (mode === 'indopak') return word.indopak ?? word.text
  return word.text
}
