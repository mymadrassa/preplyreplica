import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { ALLOWED_KINDS, ALLOWED_LABEL, EXTENSION_BY_KIND, MAX_BYTES, detectFileKind, extensionOf, type FileKind, type UploadPurpose } from '@/lib/fileSignature'

const BUCKET_BY_PURPOSE: Record<UploadPurpose, string> = {
  document: 'teacher-documents',
  photo: 'avatars',
  video: 'teacher-videos',
}

export type Inspection =
  | { ok: true; kind: FileKind; bytes: number }
  /** `unreadable`: the file couldn't be fetched (missing, or storage unreachable). */
  | { ok: false; reason: 'not-allowed' | 'unreadable'; detail: string }

/**
 * Reads a stored file's first bytes to learn its real format (not its name or
 * declared type) and its size. Changes nothing.
 */
export async function inspectStoredFile(purpose: UploadPurpose, path: string): Promise<Inspection> {
  const storage = createSupabaseServiceRoleClient().storage.from(BUCKET_BY_PURPOSE[purpose])
  const { data: signed } = await storage.createSignedUrl(path, 60)
  if (!signed?.signedUrl) return { ok: false, reason: 'unreadable', detail: 'The file could not be found.' }

  // Only the first bytes are needed; Content-Range also gives the full size.
  const response = await fetch(signed.signedUrl, { headers: { Range: 'bytes=0-31' } }).catch(() => null)
  if (!response?.ok) return { ok: false, reason: 'unreadable', detail: 'The file could not be read.' }
  const head = new Uint8Array(await response.arrayBuffer())
  const bytes = Number(response.headers.get('content-range')?.split('/')[1] ?? head.length)

  const kind = detectFileKind(head)
  if (!kind || !ALLOWED_KINDS[purpose].includes(kind)) {
    return { ok: false, reason: 'not-allowed', detail: `Not a ${ALLOWED_LABEL[purpose]} file: its content doesn't match any accepted format (it could be a program, a web page or a script).` }
  }
  return { ok: true, kind, bytes }
}

/**
 * Checks a file a teacher just uploaded straight to storage before the app
 * records it: its real format, that its name ends with that format's
 * extension, and its size. A file that fails is deleted, so nothing unchecked
 * stays in storage. Returns null when it's fine, else the message to show.
 */
export async function verifyUpload(purpose: UploadPurpose, path: string): Promise<string | null> {
  const reject = async (message: string) => {
    await createSupabaseServiceRoleClient().storage.from(BUCKET_BY_PURPOSE[purpose]).remove([path])
    return message
  }

  const result = await inspectStoredFile(purpose, path)
  if (!result.ok) {
    return result.reason === 'unreadable' ? 'That file could not be checked. Please upload it again.' : reject(`Only ${ALLOWED_LABEL[purpose]} files are accepted.`)
  }
  if (extensionOf(path) !== EXTENSION_BY_KIND[result.kind]) {
    return reject(`That file's name doesn't match its content. Please upload a ${ALLOWED_LABEL[purpose]} file.`)
  }
  if (result.bytes > MAX_BYTES[purpose]) {
    return reject(`That file is over ${MAX_BYTES[purpose] / (1024 * 1024)} MB.`)
  }
  return null
}
