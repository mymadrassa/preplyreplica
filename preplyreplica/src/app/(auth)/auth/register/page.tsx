// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(auth)/register/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PasswordInput } from '@/components/PasswordInput'
import { Select } from '@/components/Select'
import { FormMessage } from '@/components/FormMessage'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Supabase deliberately returns no error when the email already belongs
    // to a confirmed account (anti-enumeration) — it returns a user object
    // with an empty `identities` array instead. Without this check the flow
    // falls through as if a brand-new signup succeeded.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('An account with this email already exists. Please log in instead.')
      setLoading(false)
      return
    }

    if (data.user) {
      const profile: Database['public']['Tables']['profiles']['Insert'] = {
        id: data.user.id,
        email,
        role,
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert<Database['public']['Tables']['profiles']['Insert']>(profile)

      if (profileError) {
        setError(`Profile error: ${profileError.message}`)
        setLoading(false)
        return
      }

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
