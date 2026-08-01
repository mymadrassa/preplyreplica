'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'
import { PasswordInput } from '@/components/PasswordInput'
import { FormMessage } from '@/components/FormMessage'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/auth/login')
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Reset password</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Choose a new password</h1>
      </div>
      <form onSubmit={handleSubmit} className="mt-10 grid gap-6">
        <PasswordInput label="New password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <PasswordInput label="Confirm new password" name="confirmPassword" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        {error ? <FormMessage type="error">{error}</FormMessage> : null}
        <Button type="submit" loading={loading}>Update password</Button>
      </form>
    </main>
  )
}
