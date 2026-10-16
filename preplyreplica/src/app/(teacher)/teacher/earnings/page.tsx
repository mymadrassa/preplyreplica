import { redirect } from 'next/navigation'
import { TrendingUp, Wallet, Banknote } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Card } from '@/components/Card'
import { StatusBadge } from '@/components/StatusBadge'
import { EarningsTrendChart } from '@/components/EarningsTrendChart'
import { toPounds } from '@/lib/pricing'
import { formatBookingDateTime } from '@/lib/format'

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Authorizing',
  authorized: 'Authorized',
  succeeded: 'Captured',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
  failed: 'Failed',
}

function monthKey(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default async function TeacherEarningsPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id
  if (!userId) {
    redirect('/auth/login')
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, subject, start_at, profiles!student_id(full_name, email), payments(*)')
    .eq('teacher_id', userId)
    .order('start_at', { ascending: false })

  const rows = ((bookings as any[]) ?? [])
    .map((booking) => ({ booking, payment: booking.payments?.[0] }))
    .filter((row) => Boolean(row.payment))

  const availableBalancePence = rows
    .filter((r) => r.payment.status === 'succeeded' && !r.payment.payout_at)
    .reduce((sum, r) => sum + r.payment.teacher_fee, 0)
  const paidOutPence = rows
    .filter((r) => r.payment.status === 'succeeded' && r.payment.payout_at)
    .reduce((sum, r) => sum + r.payment.teacher_fee, 0)
  const lifetimePence = availableBalancePence + paidOutPence

  // Last 6 calendar months, oldest first, so the trend reads left-to-right.
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1) // pin to the 1st before subtracting months, so this never rolls into the wrong month
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const month = d.toLocaleDateString('en-GB', { month: 'short' })
    const amountPence = rows
      .filter((r) => r.payment.status === 'succeeded' && monthKey(r.payment.created_at) === key)
      .reduce((sum, r) => sum + r.payment.teacher_fee, 0)
    return { month, amountPence }
  })

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Earnings</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your balance and payment history</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <Wallet className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Available balance</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">£{toPounds(availableBalancePence).toFixed(2)}</p>
          <p className="mt-1 text-sm text-slate-500">Captured, awaiting payout</p>
        </Card>
        <Card>
          <Banknote className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Paid out</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">£{toPounds(paidOutPence).toFixed(2)}</p>
          <p className="mt-1 text-sm text-slate-500">Already sent to your bank</p>
        </Card>
        <Card>
          <TrendingUp className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Lifetime earnings</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">£{toPounds(lifetimePence).toFixed(2)}</p>
          <p className="mt-1 text-sm text-slate-500">Balance + paid out</p>
        </Card>
      </div>

      <Card className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Monthly earnings</h2>
        <div className="mt-4">
          <EarningsTrendChart data={trendData} />
        </div>
      </Card>

      <Card className="mt-8 !p-0">
        <div className="p-6 pb-0">
          <h2 className="text-lg font-semibold text-slate-900">Payment history</h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          {rows.length ? (
            <table className="min-w-[720px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Student</th>
                  <th className="px-6 py-3 font-semibold">Subject</th>
                  <th className="px-6 py-3 font-semibold">Amount</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Paid out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ booking, payment }) => (
                  <tr key={payment.id} className="align-middle transition-colors hover:bg-slate-50">
                    <td className="whitespace-nowrap px-6 py-3 text-slate-700">{formatBookingDateTime(payment.created_at)}</td>
                    <td className="whitespace-nowrap px-6 py-3 text-slate-900">{booking.profiles?.full_name || booking.profiles?.email || 'Student'}</td>
                    <td className="px-6 py-3 text-slate-700">{booking.subject}</td>
                    <td className="whitespace-nowrap px-6 py-3 font-medium text-slate-900">£{toPounds(payment.teacher_fee).toFixed(2)}</td>
                    <td className="whitespace-nowrap px-6 py-3">
                      <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status] ?? payment.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-slate-500">{payment.payout_at ? formatBookingDateTime(payment.payout_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-6 pb-6 text-slate-600">No payments yet.</p>
          )}
        </div>
      </Card>
    </main>
  )
}
