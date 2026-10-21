// King Fahd Complex per-page glyph fonts (QCF v1), the same files Quran.com
// uses: each page of the Madinah Mushaf has its own font.
const FONT_BASE = 'https://verses.quran.foundation/fonts/quran/hafs/v1/woff2'

export function qcfFamily(fontPage: number): string {
  return `QCF_P${String(fontPage).padStart(3, '0')}`
}

const loading = new Map<number, Promise<boolean>>()

function ensureQcfFont(fontPage: number): Promise<boolean> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve(false)
  const existing = loading.get(fontPage)
  if (existing) return existing

  const face = new FontFace(qcfFamily(fontPage), `url(${FONT_BASE}/p${fontPage}.woff2)`, { display: 'block' })
  const promise = face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded)
      return true
    })
    .catch(() => {
      loading.delete(fontPage)
      return false
    })
  loading.set(fontPage, promise)
  return promise
}

/** Resolves true only if every requested page font loaded. */
export async function ensureQcfFonts(fontPages: number[]): Promise<boolean> {
  const results = await Promise.all([...new Set(fontPages)].map(ensureQcfFont))
  return results.every(Boolean)
}
