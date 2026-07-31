// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(public)/page.tsx
import Link from 'next/link'
import { BadgeCheck, CalendarCheck2, ShieldCheck, Video } from 'lucide-react'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'

const steps = [
  {
    icon: BadgeCheck,
    label: 'Step 1',
    title: 'Choose your discipline',
    description: 'Search teachers by subject, language, price, or availability.',
  },
  {
    icon: CalendarCheck2,
    label: 'Step 2',
    title: 'Book your lesson',
    description: 'Reserve a time slot and pay securely in one flow.',
  },
  {
    icon: Video,
    label: 'Step 3',
    title: 'Learn live',
    description: 'Join the session and get personalized, one-to-one guidance.',
  },
]

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-[2rem] bg-white px-6 py-10 shadow-soft sm:px-10 sm:py-16">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-100 opacity-60 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Private tutoring, reimagined
            </p>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Find your next tutor and learn with confidence.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Discover verified teachers, book lessons instantly and pay securely. Everything is built for online tutoring success.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/teachers">
                <Button className="w-full sm:w-auto">Find tutors</Button>
              </Link>
              <Link href="/auth/register">
                <Button variant="secondary" className="w-full sm:w-auto">Create an account</Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-slate-100 bg-slate-50/80 shadow-none">
              <BadgeCheck className="h-6 w-6 text-brand-600" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Trusted teachers</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">Verified profiles with reviews and experience.</p>
            </Card>
            <Card className="border-slate-100 bg-slate-50/80 shadow-none">
              <ShieldCheck className="h-6 w-6 text-brand-600" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Secure payments</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">Stripe checkout for stress-free bookings.</p>
            </Card>
          </div>
        </div>
      </header>

      <section className="mt-14">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">How it works</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">Three steps to your first lesson</h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.title} className="relative">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">{step.label}</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-3 text-slate-600">{step.description}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
