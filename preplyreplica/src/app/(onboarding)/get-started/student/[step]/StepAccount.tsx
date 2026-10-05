'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PasswordInput } from '@/components/PasswordInput'
import { FormMessage } from '@/components/FormMessage'
import { useWizard } from '@/components/onboarding/WizardProvider'
import { useStepGuard } from '@/components/onboarding/useStepGuard'

export function StepAccount() {
  useStepGuard('account')
  const router = useRouter()
  const { state, reset } = useWizard()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationNeeded, setConfirmationNeeded] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const response = await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        courses: state.courses,
        immediateAvailability: state.immediateAvailability,
        weeklySlots: state.weeklySlots,
        rhythm: state.rhythm,
        packageSize: state.packageSize,
        selectedTeacherId: state.selectedTeacherId,
      }),
    })

    const result = await response.json()
    if (!response.ok) {
      setError(result.error || 'Something went wrong creating your account.')
      setLoading(false)
      return
    }

    reset()

    if (result.needsEmailConfirmation) {
      setConfirmationNeeded(true)
      setLoading(false)
      return
    }

    router.push(result.redirectTo || '/student/dashboard')
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
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Almost there</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Create your account</h1>
        <p className="mt-3 text-slate-600">We'll save your preferences and get you started.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-10 grid gap-6">
        <Input label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <PasswordInput label="Password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error ? <FormMessage type="error">{error}</FormMessage> : null}
        <Button type="submit" loading={loading}>
          Create account
        </Button>
      </form>
    </main>
  )
}
