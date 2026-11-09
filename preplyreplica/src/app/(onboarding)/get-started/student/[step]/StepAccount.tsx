'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PasswordInput } from '@/components/PasswordInput'
import { MIN_PASSWORD_LENGTH } from '@/lib/constants'
import { ConfirmEmailNotice } from '@/components/ConfirmEmailNotice'
import { useToast } from '@/components/ToastProvider'
import { normalizePhone, phoneProblem, PHONE_HINT } from '@/lib/phone'
import { PhoneInput } from '@/components/PhoneInput'
import { useWizard } from '@/components/onboarding/WizardProvider'
import { useStepGuard } from '@/components/onboarding/useStepGuard'

export function StepAccount() {
  const [submitted, setSubmitted] = useState(false)
  useStepGuard('account', !submitted)
  const router = useRouter()
  const { showToast } = useToast()
  const { state, reset } = useWizard()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationNeeded, setConfirmationNeeded] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return showToast('error', 'Enter your first and last name.')
    if (!normalizePhone(phone)) return showToast('error', phoneProblem(phone) ?? PHONE_HINT)
    if (password.length < MIN_PASSWORD_LENGTH) return showToast('error', `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    setLoading(true)

    const response = await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password,
        phone,
        gender: state.gender,
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
      showToast('error', result.error || 'Something went wrong creating your account.')
      setLoading(false)
      return
    }

    setSubmitted(true)
    reset()

    if (result.needsEmailConfirmation) {
      setConfirmationNeeded(true)
      setLoading(false)
      return
    }

    router.push(result.redirectTo || '/student/dashboard')
  }

  if (confirmationNeeded) return <ConfirmEmailNotice email={email} />

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Almost there</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Create your account</h1>
        <p className="mt-3 text-slate-600">We'll save your preferences and get you started.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-10 grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" name="firstName" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={60} required />
          <Input label="Last name" name="lastName" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={60} required />
        </div>
        <Input label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <PhoneInput value={phone} onChange={setPhone} help={'Your homework is sent to it on WhatsApp. Never shown to your teachers.'} />
        <PasswordInput label="Password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} minChars={MIN_PASSWORD_LENGTH} autoComplete="new-password" required />
        <Button type="submit" loading={loading}>
          Create account
        </Button>
      </form>
    </main>
  )
}
