// The IndoPak Nastaleeq font Quran.com uses for its IndoPak script, from the same CDN as the Madinah page fonts.
const FONT_URL = 'https://verses.quran.foundation/fonts/quran/hafs/nastaleeq/indopak/indopak-nastaleeq-waqf-lazim-v4.2.1.woff2'

export const INDOPAK_FAMILY = 'MushafIndoPak'

let loading: Promise<boolean> | null = null

/** Loads the font once per browser session; resolves false if it can't be loaded (the page then falls back to plain text). */
export function ensureIndopakFont(): Promise<boolean> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve(false)
  if (!loading) {
    loading = new FontFace(INDOPAK_FAMILY, `url(${FONT_URL})`, { display: 'block' })
      .load()
      .then((face) => {
        document.fonts.add(face)
        return true
      })
      .catch(() => {
        loading = null
        return false
      })
  }
  return loading
}
