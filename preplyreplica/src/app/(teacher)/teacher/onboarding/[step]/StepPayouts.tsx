'use client'

import { useRouter } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { useTeacherWizard } from '@/components/onboarding/TeacherWizardProvider'
import { useTeacherStepGuard } from '@/components/onboarding/useTeacherStepGuard'
import { TEACHER_WIZARD_STEPS } from './steps'

// Reached only right after StepMedia's successful submit, which resets the
// wizard and patches just `onboardingUrl` back on -- the guard is
// permanently off here since there's nothing earlier to validate against.
export function StepPayouts() {
  useTeacherStepGuard('payouts', false)
  const router = useRouter()
  const { state } = useTeacherWizard()

  return (
    <WizardShell
      step="payouts"
      steps={TEACHER_WIZARD_STEPS}
      title="Set up your payouts"
      subtitle="Required before an admin can approve your profile -- without it, there's nowhere for a student's payment to go."
      onNext={() => (state.onboardingUrl ? window.location.assign(state.onboardingUrl) : router.push('/teacher/dashboard'))}
      nextLabel="Set up payouts now"
    >
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <Wallet className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
          <p>
            Your profile is saved, but an admin can't approve it until this is done. It only takes a couple of minutes,
            and you can always come back to it from your dashboard if you'd rather do it later.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.push('/teacher/dashboard')}
        className="mt-4 text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
      >
        I'll do this later
      </button>
    </WizardShell>
  )
}
