import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { ALLOWED_KINDS, ALLOWED_LABEL, EXTENSION_BY_KIND, MAX_BYTES, detectFileKind, extensionOf, type UploadPurpose } from '@/lib/fileSignature'

const BUCKET_BY_PURPOSE: Record<UploadPurpose, string> = {
  document: 'teacher-documents',
  photo: 'avatars',
  video: 'teacher-videos',
}

/**
 * Checks a file a teacher just uploaded straight to storage before the app
 * records it: its real format (from its first bytes, not its name or declared
 * type), that its name ends with that format's extension, and its size. A
 * file that fails is deleted, so nothing unchecked stays in storage.
 * Returns null when it's fine, else the message to show.
 */
export async function verifyUpload(purpose: UploadPurpose, path: string): Promise<string | null> {
  const bucket = BUCKET_BY_PURPOSE[purpose]
  const storage = createSupabaseServiceRoleClient().storage.from(bucket)
  const reject = async (message: string) => {
    await storage.remove([path])
    return message
  }

  const { data: signed } = await storage.createSignedUrl(path, 60)
  if (!signed?.signedUrl) return 'That file could not be found. Please upload it again.'

  // Only the first bytes are needed; Content-Range also gives the full size.
  const response = await fetch(signed.signedUrl, { headers: { Range: 'bytes=0-31' } }).catch(() => null)
  if (!response?.ok) return 'That file could not be checked. Please upload it again.'
  const head = new Uint8Array(await response.arrayBuffer())
  const total = Number(response.headers.get('content-range')?.split('/')[1] ?? head.length)

  const kind = detectFileKind(head)
  if (!kind || !ALLOWED_KINDS[purpose].includes(kind)) {
    return reject(`Only ${ALLOWED_LABEL[purpose]} files are accepted.`)
  }
  if (extensionOf(path) !== EXTENSION_BY_KIND[kind]) {
    return reject(`That file's name doesn't match its content. Please upload a ${ALLOWED_LABEL[purpose]} file.`)
  }
  if (total > MAX_BYTES[purpose]) {
    return reject(`That file is over ${MAX_BYTES[purpose] / (1024 * 1024)} MB.`)
  }
  return null
}
