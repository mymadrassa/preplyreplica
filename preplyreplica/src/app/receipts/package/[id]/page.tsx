import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadPackageReceipt } from '@/lib/loadReceipts'
import { StudentReceiptView } from '@/components/receipts/StudentReceiptView'

export const metadata = { title: 'Receipt · My Madrassa' }

/** The receipt of a lesson package. */
export default async function PackageReceiptPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const userId = (await supabase.auth.getSession()).data?.session?.user?.id
  if (!userId) redirect(`/auth/login?next=/receipts/package/${params.id}`)
  const doc = await loadPackageReceipt(params.id, userId)
  if (!doc) notFound()
  return <StudentReceiptView doc={doc} backHref={doc.studentId === userId ? '/student/receipts' : '/teacher/earnings'} />
}
