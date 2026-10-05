'use client'

import { useRouter } from 'next/navigation'
import { SelectionCard } from '@/components/onboarding/SelectionCard'

export default function GetStartedPage() {
  const router = useRouter()

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col justify-center px-4 py-16 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Get started</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Are you a teacher or a student?</h1>
      </div>

      <div className="mt-10 grid gap-4">
        <SelectionCard
          label="I'm a student"
          description="Find a tutor and start learning."
          selected={false}
          onClick={() => router.push('/get-started/student/course')}
        />
        <SelectionCard
          label="I'm a teacher"
          description="Create a profile and start earning."
          selected={false}
          onClick={() => router.push('/auth/register?role=teacher')}
        />
      </div>
    </main>
  )
}
