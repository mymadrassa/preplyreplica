import { companyDetails } from '@/lib/company'
import { TIERS, TIER_ORDER, TRIAL } from '@/lib/pricing'
import { PAYOUT_DAY } from '@/lib/payouts'
import { REPORT_WINDOW_HOURS } from '@/lib/sessionFeedback'

export const metadata = { title: 'Teacher terms · My Madrassa' }

const ordinal = (n: number) => `${n}${n === 1 || n === 21 || n === 31 ? 'st' : n === 2 || n === 22 ? 'nd' : n === 3 || n === 23 ? 'rd' : 'th'}`

// First draft, to be reviewed by a lawyer or accountant before launch.

/** The teachers' terms: their status, their pay per tier, when they're paid, and how reports affect it. */
export default function TeacherTermsPage() {
  const company = companyDetails()
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Terms</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Terms for teachers</h1>
      <div className="mt-8 space-y-6 text-slate-700 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900">
        <section>
          <h2>1. Working with {company.name}</h2>
          <p>
            You give lessons to {company.name}&apos;s students as an independent, self-employed teacher. {company.name} sells the lessons to students, takes their
            payments and pays you for each lesson you give. You choose your availability and accept or decline trial requests.
          </p>
        </section>
        <section>
          <h2>2. Your pay</h2>
          <p>You&apos;re paid a fixed rate per one-hour lesson, set by your tier, and it rises as you move up:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {TIER_ORDER.map((tier) => (
              <li key={tier}>
                {TIERS[tier].label}: £{TIERS[tier].rate.toFixed(2)} per lesson
              </li>
            ))}
            <li>
              A {TRIAL.minutes}-minute trial lesson: £{TRIAL.teacherReceives.toFixed(2)}
            </li>
          </ul>
          <p className="mt-2">
            You always receive your full rate. Card processing fees are paid by {company.name}, and package discounts come out of {company.name}&apos;s share, never
            yours.
          </p>
        </section>
        <section>
          <h2>3. When you&apos;re paid</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>A lesson becomes payable {REPORT_WINDOW_HOURS} hours after it ends, unless a problem is reported.</li>
            <li>Trial lessons are paid on their own, right after those {REPORT_WINDOW_HOURS} hours.</li>
            <li>
              All your other lessons of a month are paid together on the {ordinal(PAYOUT_DAY)} of the next month, by transfer to your Stripe account and then to your bank.
            </li>
            <li>Every payout comes with a statement listing each lesson, what the student paid, the card fee, {company.name}&apos;s share and your pay.</li>
            <li>Lessons you&apos;ve given are always paid, including if you stop teaching with us.</li>
          </ul>
        </section>
        <section>
          <h2>4. If a problem is reported</h2>
          <p>
            If you or your student reports a problem with a lesson, its payment is put on hold and our team looks at what happened (including when each of you was in the
            lesson room), then decides: you&apos;re paid, the student is refunded, or a part of it is refunded. We tell you our decision in your messages, and you can
            reply with your side.
          </p>
        </section>
        <section>
          <h2>5. Taxes</h2>
          <p>
            As a self-employed teacher you&apos;re responsible for declaring this income (in the UK, on your Self Assessment tax return). Your yearly summary on the
            Earnings page lists everything you were paid in each tax year.
          </p>
        </section>
        <section>
          <h2>6. Contact</h2>
          <p>
            {company.name}
            {company.address ? `, ${company.address}` : ''} · {company.email}
          </p>
        </section>
      </div>
    </main>
  )
}
