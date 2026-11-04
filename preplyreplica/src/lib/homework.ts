// The cahier de texte: per lesson, a revision range and a new-memorisation
// range (surah/ayah to surah/ayah) plus an optional note.

export interface AyahRange {
  fromSurah: number
  fromAyah: number
  toSurah: number
  toAyah: number
}

export interface SurahMeta {
  id: number
  name: string
  verses: number
}

export interface HomeworkContent {
  revision: AyahRange | null
  memorization: AyahRange | null
  note: string | null
}

/** Why a range is invalid, or null when it's fine. */
export function validateRange(range: AyahRange, surahs: SurahMeta[] = []): string | null {
  const { fromSurah, fromAyah, toSurah, toAyah } = range
  if (![fromSurah, fromAyah, toSurah, toAyah].every((n) => Number.isInteger(n) && n >= 1)) return 'Choose a surah and ayah for both ends.'
  if (fromSurah > 114 || toSurah > 114) return 'There are only 114 surahs.'
  const verses = (id: number) => surahs.find((s) => s.id === id)?.verses
  const fromMax = verses(fromSurah)
  const toMax = verses(toSurah)
  if (fromMax && fromAyah > fromMax) return `That surah has only ${fromMax} ayat.`
  if (toMax && toAyah > toMax) return `That surah has only ${toMax} ayat.`
  if (toSurah < fromSurah || (toSurah === fromSurah && toAyah < fromAyah)) return 'The end must come after the start.'
  return null
}

/** "Al-Baqarah 1–20", "Al-Baqarah 5", or across surahs "Al-Baqarah 286 – Al-Imran 10". */
export function formatRange(range: AyahRange | null, surahs: SurahMeta[] = []): string {
  if (!range) return '—'
  const name = (id: number) => surahs.find((s) => s.id === id)?.name ?? `Surah ${id}`
  const { fromSurah, fromAyah, toSurah, toAyah } = range
  if (fromSurah === toSurah) {
    return fromAyah === toAyah ? `${name(fromSurah)} ${fromAyah}` : `${name(fromSurah)} ${fromAyah}–${toAyah}`
  }
  return `${name(fromSurah)} ${fromAyah} – ${name(toSurah)} ${toAyah}`
}

/** Database columns (revision_from_surah, …) ⇄ a range, for one prefix. */
export function rangeFromRow(row: Record<string, unknown>, prefix: 'revision' | 'memorization'): AyahRange | null {
  const value = (key: string) => row[`${prefix}_${key}`] as number | null | undefined
  const fromSurah = value('from_surah')
  if (!fromSurah) return null
  return { fromSurah, fromAyah: value('from_ayah')!, toSurah: value('to_surah')!, toAyah: value('to_ayah')! }
}

export function rangeToRow(range: AyahRange | null, prefix: 'revision' | 'memorization') {
  return {
    [`${prefix}_from_surah`]: range?.fromSurah ?? null,
    [`${prefix}_from_ayah`]: range?.fromAyah ?? null,
    [`${prefix}_to_surah`]: range?.toSurah ?? null,
    [`${prefix}_to_ayah`]: range?.toAyah ?? null,
  } as Record<string, number | null>
}

/** The parts every channel (WhatsApp template, email) shows, already formatted. */
export function homeworkParts(content: HomeworkContent, surahs: SurahMeta[]) {
  return {
    revision: formatRange(content.revision, surahs),
    memorization: formatRange(content.memorization, surahs),
    note: content.note?.trim() || '—',
  }
}
