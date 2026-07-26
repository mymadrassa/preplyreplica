// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(public)/page.tsx
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="rounded-[2rem] bg-white px-6 py-10 shadow-soft sm:px-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-brand-600">Private tutoring reimagined</p>
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
            <Card className="bg-slate-50">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Trusted teachers</p>
              <p className="mt-4 text-2xl font-semibold text-slate-900">Verified profiles with reviews and experience.</p>
            </Card>
            <Card className="bg-slate-50">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Secure payments</p>
              <p className="mt-4 text-2xl font-semibold text-slate-900">Stripe checkout for stress-free bookings.</p>
            </Card>
          </div>
        </div>
      </header>

      <section className="mt-14 grid gap-6 lg:grid-cols-3">
        <Card className="bg-slate-50">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-600">Step 1</p>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Choose your discipline</h2>
          <p className="mt-3 text-slate-600">Search teachers by subject, language, or availability.</p>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-600">Step 2</p>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Book your lesson</h2>
          <p className="mt-3 text-slate-600">Reserve a time slot and pay securely in one flow.</p>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-600">Step 3</p>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Learn live</h2>
          <p className="mt-3 text-slate-600">Join the session and get personalized guidance.</p>
        </Card>
      </section>
    </main>
  )
}
