import { NextResponse } from 'next/server'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { scanUncheckedDocuments, type ScanStatus } from '@/lib/documentScan'
import { extensionOf } from '@/lib/fileSignature'

type DocumentForAccess = { id: string; bucket_path: string; kind: string; scan_status: ScanStatus }

/**
 * Loads one teacher document for its owner or an admin (RLS on
 * teacher_documents allows exactly them) and makes sure it has been
 * safety-checked. Returns the document, or the response to send back.
 */
export async function loadCheckedDocument(id: string): Promise<{ document: DocumentForAccess; status: ScanStatus } | { response: NextResponse }> {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  if (!session.data?.session?.user?.id) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: document } = await supabase.from('teacher_documents').select('id, bucket_path, kind, scan_status').eq('id', id).maybeSingle()
  if (!document) {
    return { response: NextResponse.json({ error: 'Document not found.' }, { status: 404 }) }
  }
  const scanned = await scanUncheckedDocuments([document])
  return { document, status: scanned.get(document.id)?.status ?? document.scan_status }
}

/** A short-lived link to the file; `downloadAs` makes the browser save it instead of opening it. */
export async function signedDocumentLink(path: string, downloadAs?: string): Promise<string | null> {
  const { data } = await createSupabaseServiceRoleClient()
    .storage.from('teacher-documents')
    .createSignedUrl(path, 60, downloadAs ? { download: downloadAs } : undefined)
  return data?.signedUrl ?? null
}

/** The name a downloaded document is saved under. A suspicious file gets `.bin`, so it can't run on a double-click. */
export function downloadName(document: DocumentForAccess, status: ScanStatus): string {
  const base = `${document.kind === 'certificate' ? 'certificate' : 'id-document'}-${document.id.slice(0, 8)}`
  if (status === 'suspicious') return `${base}-SUSPICIOUS.bin`
  return `${base}.${extensionOf(document.bucket_path) || 'bin'}`
}
