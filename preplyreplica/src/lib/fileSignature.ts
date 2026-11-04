// What a file really is, from its first bytes ("magic numbers"), not from its
// name or the type the browser declares (both are chosen by the uploader).
// Used to accept only real PDFs, images and videos from teachers: a renamed
// executable, an HTML page or an SVG with a script never matches.

export type FileKind = 'pdf' | 'jpeg' | 'png' | 'webp' | 'mp4' | 'mov' | 'webm'
export type UploadPurpose = 'document' | 'photo' | 'video'

export const ALLOWED_KINDS: Record<UploadPurpose, FileKind[]> = {
  document: ['pdf', 'jpeg', 'png', 'webp'],
  photo: ['jpeg', 'png', 'webp'],
  video: ['mp4', 'mov', 'webm'],
}

export const MAX_BYTES: Record<UploadPurpose, number> = {
  document: 10 * 1024 * 1024,
  photo: 5 * 1024 * 1024,
  video: 50 * 1024 * 1024,
}

export const MIME_BY_KIND: Record<FileKind, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

export const EXTENSION_BY_KIND: Record<FileKind, string> = { pdf: 'pdf', jpeg: 'jpg', png: 'png', webp: 'webp', mp4: 'mp4', mov: 'mov', webm: 'webm' }

/** The plain-words list for messages, e.g. "PDF, JPEG, PNG or WebP". */
export const ALLOWED_LABEL: Record<UploadPurpose, string> = {
  document: 'PDF, JPEG, PNG or WebP',
  photo: 'JPEG, PNG or WebP',
  video: 'MP4, MOV or WebM',
}

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length))
const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b)

/** The file's real format from its first 16+ bytes, or null if it's none of the accepted ones. */
export function detectFileKind(bytes: Uint8Array): FileKind | null {
  if (ascii(bytes, 0, 5) === '%PDF-') return 'pdf'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp'
  if (ascii(bytes, 4, 4) === 'ftyp') return ascii(bytes, 8, 4) === 'qt  ' ? 'mov' : 'mp4'
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm'
  return null
}

/** The kind a browser-declared MIME type claims to be (for early, friendly checks in the browser). */
export function kindFromMime(mime: string): FileKind | null {
  const entry = Object.entries(MIME_BY_KIND).find(([, value]) => value === mime)
  return entry ? (entry[0] as FileKind) : null
}

/** The extension at the end of a storage path, lowercased. */
export function extensionOf(path: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(path)
  return match ? match[1].toLowerCase() : ''
}
