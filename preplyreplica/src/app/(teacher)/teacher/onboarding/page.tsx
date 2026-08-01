// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(teacher)/onboarding/page.tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { TeacherOnboardingForm } from '@/components/TeacherOnboardingForm'
import { StatusBadge } from '@/components/StatusBadge'
import { Card } from '@/components/Card'

export default async function TeacherOnboardingPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id

  if (!userId) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('teacher_profiles')
    .select('*, profiles(*)')
    .eq('id', userId)
    .single()

  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">Teacher onboarding</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Complete your profile and Stripe setup</h1>
        </div>
        <StatusBadge status={profile?.status ?? 'pending'} />
      </div>
      <p className="max-w-2xl text-slate-600">
        Provide your teaching details, upload documents, and set up Stripe payouts. Your profile stays hidden from students until an admin approves it.
      </p>
      <Card className="mt-8">
        <TeacherOnboardingForm existingProfile={profile} />
      </Card>
    </main>
  )
}
