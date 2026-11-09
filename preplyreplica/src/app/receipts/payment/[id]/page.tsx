import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadPaymentReceipt } from '@/lib/loadReceipts'
import { StudentReceiptView } from '@/components/receipts/StudentReceiptView'

export const metadata = { title: 'Receipt · My Madrassa' }

/** The receipt of a trial lesson's payment. */
export default async function PaymentReceiptPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const userId = (await supabase.auth.getSession()).data?.session?.user?.id
  if (!userId) redirect(`/auth/login?next=/receipts/payment/${params.id}`)
  const doc = await loadPaymentReceipt(params.id, userId)
  if (!doc) notFound()
  return <StudentReceiptView doc={doc} backHref={doc.studentId === userId ? '/student/receipts' : '/teacher/earnings'} />
}
