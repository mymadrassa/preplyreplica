import { Lock, Mail } from 'lucide-react'

/** The account's email on the user's own profile: shown to them only, never on public pages. */
export function PrivateEmail({ email }: { email: string | null | undefined }) {
  if (!email) return null
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600">
        <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <span className="font-medium text-slate-900">Email:</span>
        <span className="break-all text-slate-900">{email}</span>
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
        <Lock className="h-3 w-3" aria-hidden="true" /> Only you can see this. You log in with it and we send your emails there.
      </p>
    </div>
  )
}
