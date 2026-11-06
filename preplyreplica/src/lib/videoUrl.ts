// Turns a pasted share link from a known, trusted video host into the
// actual embeddable URL, and rejects everything else. This is a deliberate
// allow-list, not just "is this a valid URL" -- the result gets embedded in
// an <iframe> on a public profile page, so accepting an arbitrary
// attacker-chosen domain (or a javascript:/data: scheme) would let someone
// load arbitrary content there. Every pattern below is anchored to
// `^https:\/\/` and a specific host, so nothing else can match.

export type VideoProvider = 'youtube' | 'vimeo' | 'google-drive'

export interface NormalizedVideoUrl {
  embedUrl: string
  provider: VideoProvider
}

const PATTERNS: { test: RegExp; provider: VideoProvider; embedUrl: (id: string) => string }[] = [
  { test: /^https:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/, provider: 'youtube', embedUrl: (id) => `https://www.youtube.com/embed/${id}` },
  { test: /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/, provider: 'youtube', embedUrl: (id) => `https://www.youtube.com/embed/${id}` },
  { test: /^https:\/\/youtu\.be\/([a-zA-Z0-9_-]{6,})/, provider: 'youtube', embedUrl: (id) => `https://www.youtube.com/embed/${id}` },
  { test: /^https:\/\/player\.vimeo\.com\/video\/(\d+)/, provider: 'vimeo', embedUrl: (id) => `https://player.vimeo.com/video/${id}` },
  { test: /^https:\/\/(?:www\.)?vimeo\.com\/(\d+)/, provider: 'vimeo', embedUrl: (id) => `https://player.vimeo.com/video/${id}` },
  // Google Drive's normal "share" link (/file/d/<id>/view) can't be framed
  // directly -- it has to be rewritten to the /preview path to embed.
  { test: /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/, provider: 'google-drive', embedUrl: (id) => `https://drive.google.com/file/d/${id}/preview` },
]

export function normalizeVideoUrl(raw: string): NormalizedVideoUrl | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  for (const pattern of PATTERNS) {
    const match = trimmed.match(pattern.test)
    if (match) return { embedUrl: pattern.embedUrl(match[1]), provider: pattern.provider }
  }

  return null
}

/**
 * The normal page to watch a stored embed link on its host. An embed link
 * (youtube.com/embed/…) only plays inside a page: opened on its own, YouTube
 * refuses it ("Error 153") because it can't tell which site embeds it.
 */
export function watchUrlFor(embedUrl: string): { url: string; host: string } | null {
  const youtube = /^https:\/\/www\.youtube\.com\/embed\/([a-zA-Z0-9_-]+)/.exec(embedUrl)
  if (youtube) return { url: `https://www.youtube.com/watch?v=${youtube[1]}`, host: 'YouTube' }
  const vimeo = /^https:\/\/player\.vimeo\.com\/video\/(\d+)/.exec(embedUrl)
  if (vimeo) return { url: `https://vimeo.com/${vimeo[1]}`, host: 'Vimeo' }
  const drive = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/preview/.exec(embedUrl)
  if (drive) return { url: `https://drive.google.com/file/d/${drive[1]}/view`, host: 'Google Drive' }
  return null
}
