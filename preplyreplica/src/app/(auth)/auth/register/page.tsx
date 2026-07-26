// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(auth)/register/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [error, setError] = useState('')
  const supabase = createBrowserClient()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
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
        return
      }

      router.push(role === 'teacher' ? '/teacher/onboarding' : '/student/dashboard')
          }
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Register</h1>
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
          <Button type="submit">Create account</Button>
        </form>
      </div>
    </main>
  )
}
