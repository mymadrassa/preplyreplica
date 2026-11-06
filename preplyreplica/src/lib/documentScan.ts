import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { inspectStoredFile } from '@/lib/verifyUpload'

export type ScanStatus = 'clean' | 'suspicious' | null

interface DocumentToScan {
  id: string
  bucket_path: string
  scan_status: ScanStatus
}

/** Records a document's safety check (server key: teachers can't set it themselves). */
export async function recordScan(documentId: string, status: Exclude<ScanStatus, null>, detail: string | null) {
  await createSupabaseServiceRoleClient()
    .from('teacher_documents')
    .update({ scan_status: status, scan_detail: detail, scanned_at: new Date().toISOString() })
    .eq('id', documentId)
}

/**
 * Checks documents that haven't been checked yet (uploaded before checks
 * existed) and stores the result, so the admin is warned about a suspicious
 * file before opening it. Returns each document's status by id. A file that
 * can't be read stays unchecked and is tried again next time.
 */
export async function scanUncheckedDocuments(documents: DocumentToScan[]): Promise<Map<string, { status: ScanStatus; detail: string | null }>> {
  const results = new Map<string, { status: ScanStatus; detail: string | null }>()
  await Promise.all(
    documents.map(async (doc) => {
      if (doc.scan_status) return
      const inspection = await inspectStoredFile('document', doc.bucket_path)
      if (inspection.ok) {
        await recordScan(doc.id, 'clean', null)
        results.set(doc.id, { status: 'clean', detail: null })
      } else if (inspection.reason === 'not-allowed') {
        await recordScan(doc.id, 'suspicious', inspection.detail)
        results.set(doc.id, { status: 'suspicious', detail: inspection.detail })
      }
    })
  )
  return results
}
