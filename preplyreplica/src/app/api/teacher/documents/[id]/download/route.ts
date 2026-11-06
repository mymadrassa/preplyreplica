import { NextResponse } from 'next/server'
import { downloadName, loadCheckedDocument, signedDocumentLink } from '@/lib/documentAccess'

/** Downloads one of a teacher's private documents (its owner or an admin) instead of opening it. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const loaded = await loadCheckedDocument(params.id)
  if ('response' in loaded) return loaded.response
  const url = await signedDocumentLink(loaded.document.bucket_path, downloadName(loaded.document, loaded.status))
  if (!url) return NextResponse.json({ error: 'Unable to download this document.' }, { status: 500 })
  return NextResponse.redirect(url)
}
