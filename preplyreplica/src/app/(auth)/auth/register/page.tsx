// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(auth)/register/page.tsx
'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { completeSignup } from '@/lib/auth/completeSignup'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PasswordInput } from '@/components/PasswordInput'
import { Select } from '@/components/Select'
import { FormMessage } from '@/components/FormMessage'

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
  const initialRole = searchParams.get('role') === 'teacher' ? 'teacher' : 'student'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>(initialRole)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const result = await completeSignup(supabase, {
      email,
      password,
      role,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    })

    if (!result.ok) {
      setError(result.message)
      setLoading(false)
      return
    }

    if (result.hasSession) {
      router.push(role === 'teacher' ? '/teacher/onboarding' : '/student/dashboard')
    } else {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Get started</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Create your account</h1>
        <p className="mt-3 text-slate-600">Join as a student to book lessons, or a teacher to start earning.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-10 grid gap-6">
        <Input label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <PasswordInput label="Password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <Select
          label="Register as"
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value as 'student' | 'teacher')}
          options={[
            { value: 'student', label: 'Student' },
            { value: 'teacher', label: 'Teacher' },
          ]}
          required
        />
        {error ? <FormMessage type="error">{error}</FormMessage> : null}
        <Button type="submit" loading={loading}>Create account</Button>
      </form>
    </main>
  )
}
