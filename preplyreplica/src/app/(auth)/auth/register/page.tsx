// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(auth)/register/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { role },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('An account with this email already exists. Please log in instead.')
      setLoading(false)
      return
    }

    if (data.session) {
      router.push(role === 'teacher' ? '/teacher/onboarding' : '/student/dashboard')
      router.refresh()
      return
    }

    setLoading(false)
    setCheckEmail(true)
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Register</h1>
        {checkEmail ? (
          <p className="text-sm text-slate-700">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then log in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <Input label="Password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
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
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" loading={loading}>Create account</Button>
          </form>
        )}
      </div>
    </main>
  )
}
