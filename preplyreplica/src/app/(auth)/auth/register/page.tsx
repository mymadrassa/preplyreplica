// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(auth)/register/page.tsx
'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { logClientError } from '@/lib/logClientError'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PasswordInput } from '@/components/PasswordInput'
import { FormMessage } from '@/components/FormMessage'
import { useToast } from '@/components/ToastProvider'

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Role comes entirely from how the student got here (the "I'm a
  // teacher"/"I'm a student" choice on /get-started) -- asking again on this
  // form would just be re-asking a question already answered.
  const role = searchParams.get('role') === 'teacher' ? 'teacher' : 'student'
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationNeeded, setConfirmationNeeded] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
    const data = await response.json()

    if (!response.ok) {
      showToast('error', data.error)
      logClientError('register', data.error)
      setLoading(false)
      return
    }

    if (data.hasSession) {
      router.push(role === 'teacher' ? '/teacher/onboarding' : '/student/dashboard')
    } else {
      // Email confirmation is required and no session exists yet -- there's
      // nowhere to redirect to, so say so instead of leaving the form
      // looking like it silently did nothing.
      setConfirmationNeeded(true)
      setLoading(false)
    }
  }

  if (confirmationNeeded) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
        <FormMessage type="success">Check your email to confirm your account, then log in to continue.</FormMessage>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Get started</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
          {role === 'teacher' ? 'Create your teacher account' : 'Create your account'}
        </h1>
        <p className="mt-3 text-slate-600">
          {role === 'teacher' ? 'Set up your profile and start earning.' : 'Join to book lessons with a tutor.'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="mt-10 grid gap-6">
        <Input label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <PasswordInput label="Password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <Button type="submit" loading={loading}>Create account</Button>
      </form>
    </main>
  )
}
