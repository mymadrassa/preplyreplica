import { NextResponse } from 'next/server'
import { loadCheckedDocument, signedDocumentLink } from '@/lib/documentAccess'

/**
 * Opens one of a teacher's private documents in the browser (its owner or an
 * admin), through a short-lived signed link. A file that failed its safety
 * check is never opened in the browser: it can only be downloaded, renamed
 * so it can't run (see the download route).
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const loaded = await loadCheckedDocument(params.id)
  if ('response' in loaded) return loaded.response
  if (loaded.status === 'suspicious') {
    return NextResponse.json({ error: 'This file failed its safety check and can’t be opened in the browser.' }, { status: 403 })
  }
  const url = await signedDocumentLink(loaded.document.bucket_path)
  if (!url) return NextResponse.json({ error: 'Unable to open this document.' }, { status: 500 })
  return NextResponse.redirect(url)
}
