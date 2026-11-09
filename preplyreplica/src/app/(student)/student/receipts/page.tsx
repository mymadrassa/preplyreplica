import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileText } from 'lucide-react'
import { createServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { loadParticipants } from '@/lib/participantNames'
import { toPounds } from '@/lib/pricing'

type Row = { href: string; date: string; what: string; teacherName: string; amount: number; refunded: number; status: string }

const STATUS_LABELS: Record<string, string> = { paid: 'Paid', refunded: 'Refunded', partly: 'Partly refunded', on_hold: 'Not charged yet' }

/** Every payment the student made (trials and packages), each with its receipt. */
export default async function StudentReceiptsPage() {
  const supabase = createServerClient()
  const userId = (await supabase.auth.getSession()).data?.session?.user?.id
  if (!userId) redirect('/auth/login')

  const db = createSupabaseServiceRoleClient()
  const [{ data: payments }, { data: packages }] = await Promise.all([
    db
      .from('payments')
      .select('id, amount, refunded_amount, status, paid_at, created_at, bookings!inner(student_id, teacher_id, subject, start_at)')
      .eq('bookings.student_id', userId)
      .in('status', ['authorized', 'succeeded', 'refunded']),
    db
      .from('lesson_packages')
      .select('id, teacher_id, price, refunded_amount, lessons_total, paid_at, created_at, status')
      .eq('student_id', userId)
      .neq('status', 'pending_payment')
      .not('provider_payment_id', 'is', null),
  ])
  const lessonBookings = (payments ?? []).map((p) => p.bookings as unknown as { teacher_id: string; subject: string; start_at: string })
  const people = await loadParticipants([...lessonBookings.map((b) => b.teacher_id), ...(packages ?? []).map((p) => p.teacher_id)])
  const name = (id: string) => people.get(id)?.name ?? 'your teacher'
  const statusOf = (paid: number, refunded: number, charged: boolean) => (!charged ? 'on_hold' : refunded >= paid ? 'refunded' : refunded > 0 ? 'partly' : 'paid')

  const rows: Row[] = [
    ...(payments ?? []).map((p, i) => ({
      href: `/receipts/payment/${p.id}`,
      date: p.paid_at ?? p.created_at,
      what: `Trial lesson · ${lessonBookings[i].subject}`,
      teacherName: name(lessonBookings[i].teacher_id),
      amount: p.amount,
      refunded: p.refunded_amount,
      status: p.status === 'refunded' ? 'refunded' : statusOf(p.amount, p.refunded_amount, p.status !== 'authorized'),
    })),
    ...(packages ?? []).map((p) => ({
      href: `/receipts/package/${p.id}`,
      date: p.paid_at ?? p.created_at,
      what: `${p.lessons_total}-lesson package`,
      teacherName: name(p.teacher_id),
      amount: p.price,
      refunded: p.refunded_amount,
      status: statusOf(p.price, p.refunded_amount, true),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <main className="container mx-auto max-w-4xl px-4 py-12">
      <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Receipts</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your payments</h1>
      <p className="mt-2 text-slate-600">Each receipt shows the price line by line and where your money goes. Open one to print it or save it as a PDF.</p>

      {rows.length ? (
        <ul className="mt-8 divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
          {rows.map((row) => (
            <li key={row.href}>
              <Link href={row.href} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 flex-shrink-0 text-brand-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{row.what}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(row.date).toLocaleDateString('en-GB', { dateStyle: 'medium' })} · with {row.teacherName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">£{toPounds(row.amount).toFixed(2)}</p>
                  <p className="text-xs text-slate-500">
                    {STATUS_LABELS[row.status]}
                    {row.refunded > 0 && row.status === 'partly' ? ` · £${toPounds(row.refunded).toFixed(2)} back` : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No payments yet.</p>
      )}
    </main>
  )
}
