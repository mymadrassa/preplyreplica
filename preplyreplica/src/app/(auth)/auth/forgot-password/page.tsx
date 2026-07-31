'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { FormMessage } from '@/components/FormMessage'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createBrowserClient()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Reset password</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Forgot your password?</h1>
        <p className="mt-3 text-slate-600">Enter your email and we'll send you a link to reset it.</p>
      </div>
      {sent ? (
        <p className="mt-10 text-center text-slate-700">
          If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-10 grid gap-6">
          <Input label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          {error ? <FormMessage type="error">{error}</FormMessage> : null}
          <Button type="submit" loading={loading}>Send reset link</Button>
        </form>
      )}
    </main>
  )
}
