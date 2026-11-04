'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Link2Off, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'
import { PasswordInput } from '@/components/PasswordInput'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { useToast } from '@/components/ToastProvider'

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}

// The reset link signs the person in for this one purpose. Without that
// session (expired or already-used link, or opened somewhere the sign-in
// couldn't complete) there's nothing to update, so say so instead of showing
// a form that can only fail.
function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [supabase] = useState(() => createBrowserClient())

  useEffect(() => {
    if (searchParams.get('error')) {
      setState('invalid')
      return
    }
    supabase.auth.getUser().then(({ data }) => setState(data.user ? 'ready' : 'invalid'))
  }, [supabase, searchParams])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < MIN_PASSWORD_LENGTH) {
      showToast('error', `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmPassword) {
      showToast('error', 'Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      if (/session/i.test(error.message)) return setState('invalid')
      showToast('error', error.message)
      return
    }

    // Sign out so the new password is used for the next login.
    await supabase.auth.signOut()
    showToast('success', 'Password updated. Log in with your new password.')
    router.push('/auth/login')
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Reset password</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">{state === 'invalid' ? 'This link can’t be used' : 'Choose a new password'}</h1>
      </div>

      {state === 'checking' ? (
        <p className="mt-10 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking your reset link…
        </p>
      ) : state === 'invalid' ? (
        <div role="alert" className="mt-10 space-y-4 rounded-3xl border-2 border-amber-300 bg-amber-50 p-6 text-center">
          <Link2Off className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
          <p className="text-lg text-slate-800">Your reset link has expired, was already used, or was opened in a different browser.</p>
          <p className="text-sm text-slate-600">Ask for a new link and open it on this device.</p>
          <Link
            href="/auth/forgot-password"
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Send me a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-10 grid gap-6">
          <PasswordInput
            label="New password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minChars={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            required
          />
          <PasswordInput label="Confirm new password" name="confirmPassword" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
          <Button type="submit" loading={loading}>
            Update password
          </Button>
        </form>
      )}
    </main>
  )
}
