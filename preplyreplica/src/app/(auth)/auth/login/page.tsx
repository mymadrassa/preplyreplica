// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserClient()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const userId = data?.user?.id
    if (!userId) {
      setError('Unable to sign in. Please try again.')
      setLoading(false)
      return
    }

    const profileResult = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    const profileData = profileResult.data as { role: 'student' | 'teacher' | 'admin' } | null

    if (profileResult.error || !profileData?.role) {
      setError('Unable to determine your role. Please contact support.')
      setLoading(false)
      return
    }

    const destination =
      profileData.role === 'teacher'
        ? '/teacher/dashboard'
        : profileData.role === 'admin'
        ? '/admin/dashboard'
        : '/student/dashboard'

    await router.push(destination)
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full rounded-[2rem] bg-white p-8 shadow-soft sm:p-12">
        <div className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-600">Welcome back</p>
          <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Sign in to your account</h1>
          <p className="mt-3 text-slate-600">Access your lessons, bookings and teacher dashboard.</p>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-6">
          <Input label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input label="Password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" loading={loading}>Sign in</Button>
        </form>
      </div>
    </main>
  )
}
