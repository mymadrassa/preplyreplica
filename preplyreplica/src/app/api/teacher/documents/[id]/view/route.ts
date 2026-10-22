import { NextResponse } from 'next/server'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'

/**
 * Opens one of the teacher's own private documents: checks it belongs to them,
 * then redirects to a short-lived signed link. Admins may open any document.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // RLS on teacher_documents already limits this to the owner (or an admin).
  const { data: document } = await supabase.from('teacher_documents').select('bucket_path').eq('id', params.id).maybeSingle()
  if (!document) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
  }

  // Signed with the server key after the ownership check above, so documents
  // uploaded before files were kept in per-teacher folders open too.
  const { data, error } = await createSupabaseServiceRoleClient().storage.from('teacher-documents').createSignedUrl(document.bucket_path, 60)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || 'Unable to open this document.' }, { status: 500 })
  }
  return NextResponse.redirect(data.signedUrl)
}
