// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/app/(teacher)/onboarding/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import { TeacherOnboardingForm } from '@/components/TeacherOnboardingForm'
import { Card } from '@/components/Card'

export default async function TeacherOnboardingPage() {
  const supabase = createServerClient()
  const session = await supabase.auth.getSession()
  const userId = session.data?.session?.user?.id

  const { data: profile } = await supabase
    .from('teacher_profiles')
    .select('*, profiles(*)')
    .eq('id', userId)
    .single()

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-[1.7fr_1fr]">
        <section className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-brand-700">Teacher onboarding</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Complete your profile and Stripe setup</h1>
          </div>
          <Card>
            <p className="text-slate-600">Use this form to provide your teaching details, upload documents, and create your Stripe Connect account. Your profile remains hidden until approved by an admin.</p>
          </Card>
        </section>
        <aside className="space-y-6">
          <Card>
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Current status</p>
              <p className="text-slate-900">{profile?.status ?? 'pending'}</p>
            </div>
          </Card>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <TeacherOnboardingForm existingProfile={profile} />
          </div>
        </aside>
      </div>
    </main>
  )
}
