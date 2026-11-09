import { companyDetails } from '@/lib/company'
import { CANCELLATION_CUTOFF_HOURS } from '@/lib/constants'
import { PACKAGE, TRIAL } from '@/lib/pricing'
import { REPORT_WINDOW_HOURS } from '@/lib/sessionFeedback'

export const metadata = { title: 'Terms · My Madrassa' }

// First draft, to be reviewed by a lawyer or accountant before launch.

/** The students' terms: who sells the lessons, payments, cancellations, problems and refunds. */
export default function TermsPage() {
  const company = companyDetails()
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Terms</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Terms for students</h1>
      <div className="mt-8 space-y-6 text-slate-700 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900">
        <section>
          <h2>1. Who you buy from</h2>
          <p>
            Lessons are sold by {company.name}. Each lesson is given by an independent teacher who works with {company.name}; you pay {company.name}, and{' '}
            {company.name} pays the teacher. Every payment comes with a receipt that shows the price line by line and where your money goes.
          </p>
        </section>
        <section>
          <h2>2. Prices and payment</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Your first lesson with a teacher is a {TRIAL.minutes}-minute trial. Your card is put on hold when you book and charged only when the teacher confirms; if
              they don&apos;t, the hold is released and you pay nothing.
            </li>
            <li>
              After the trial, lessons with that teacher come in packages of {PACKAGE.lessons} one-hour lessons, paid upfront at {Math.round(PACKAGE.discount * 100)}% off,
              to use within {PACKAGE.validityMonths} months. Unused lessons are refunded at the discounted price per lesson when the package ends or if you cancel it.
            </li>
            <li>Card payments are processed securely by Stripe. Prices are in pounds sterling.</li>
          </ul>
        </section>
        <section>
          <h2>3. Cancelling a lesson</h2>
          <p>
            You can cancel a booked lesson up to {CANCELLATION_CUTOFF_HOURS} hours before it starts: a trial is refunded in full, a package lesson goes back into your
            package. Later than that, the lesson can&apos;t be cancelled.
          </p>
        </section>
        <section>
          <h2>4. If something goes wrong</h2>
          <p>
            After each lesson you can tell us it went well, or report a problem (the teacher didn&apos;t come, a technical problem on the platform, a lesson cut short, or
            anything else) up to {REPORT_WINDOW_HOURS} hours after it ends. The lesson is then put on hold and our team looks into it, then decides: the lesson counts as
            given, you&apos;re refunded (fully or in part), or the lesson goes back into your package. We tell you our decision in your messages.
          </p>
        </section>
        <section>
          <h2>5. Contact</h2>
          <p>
            {company.name}
            {company.address ? `, ${company.address}` : ''} · {company.email}
          </p>
        </section>
      </div>
    </main>
  )
}
