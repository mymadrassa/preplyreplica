import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from '@/components/PrintButton'
import { companyDetails } from '@/lib/company'

export function pounds(pence: number) {
  const sign = pence < 0 ? '−' : ''
  return `${sign}£${(Math.abs(pence) / 100).toFixed(2)}`
}

/**
 * The frame of a receipt or statement: My Madrassa's details, the document's
 * title, number and date, a print button, and the footer. Prints on one
 * clean A4 page (the buttons are hidden on paper).
 */
export function DocumentShell({
  title,
  number,
  date,
  backHref,
  badge,
  children,
}: {
  title: string
  number: string
  date: string | null
  backHref: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const company = companyDetails()
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xl font-bold text-brand-700">{company.name}</p>
            <div className="mt-1 space-y-0.5 text-xs text-slate-500">
              {company.address ? <p className="whitespace-pre-line">{company.address}</p> : null}
              {company.companyNumber ? <p>Company number {company.companyNumber}</p> : null}
              {company.vatNumber ? <p>VAT number {company.vatNumber}</p> : null}
              <p>{company.email}</p>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">{number}</p>
            {date ? <p className="text-sm text-slate-600">{new Date(date).toLocaleDateString('en-GB', { dateStyle: 'long' })}</p> : null}
            {badge ? <div className="mt-2">{badge}</div> : null}
          </div>
        </header>

        <div className="mt-6 space-y-6 text-sm text-slate-700">{children}</div>

        <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p>
            Lessons are sold by {company.name} and given by independent teachers. Card payments are processed by Stripe.
            {company.vatNumber ? '' : ' No VAT is charged.'}
          </p>
          <p className="mt-1">Questions about this document: {company.email}</p>
        </footer>
      </article>
    </main>
  )
}

export function StatusPill({ tone, children }: { tone: 'green' | 'amber' | 'slate' | 'red'; children: React.ReactNode }) {
  const colors = { green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', slate: 'bg-slate-100 text-slate-700', red: 'bg-red-50 text-red-700' }
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colors[tone]}`}>{children}</span>
}
