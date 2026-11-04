import Link from 'next/link'
import { MailCheck } from 'lucide-react'

/** Shown after signup while the account waits for its email confirmation. */
export function ConfirmEmailNotice({ email }: { email: string }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <div role="status" className="rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-8 text-center shadow-card sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
          <MailCheck className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-3xl font-bold text-slate-900 sm:text-4xl">Check your email</h1>
        <p className="mt-4 text-lg text-slate-700">
          We sent a confirmation link to
          {email ? <strong className="mt-1 block break-all text-slate-900">{email}</strong> : ' your email address.'}
        </p>
        <p className="mt-4 text-lg text-slate-700">Click the link to confirm your account, then log in to continue.</p>
        <p className="mt-6 text-sm text-slate-500">Nothing after a few minutes? Check your spam or promotions folder.</p>
        <Link
          href="/auth/login"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Go to log in
        </Link>
      </div>
    </main>
  )
}
