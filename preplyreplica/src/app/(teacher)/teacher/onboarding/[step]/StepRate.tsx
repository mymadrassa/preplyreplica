'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { useTeacherWizard } from '@/components/onboarding/TeacherWizardProvider'
import { useTeacherStepGuard } from '@/components/onboarding/useTeacherStepGuard'
import { TEACHER_WIZARD_STEPS } from './steps'

// £10/hour floor: even at the shortest lesson (30 min) and the lowest rate
// allowed, the platform's 40% commission still comfortably covers Stripe's
// processing fee (1.5% + £0.20) on top of everything else -- this isn't an
// arbitrary number, it's the line above which the platform's own costs are
// definitely covered, no matter the lesson length.
const MIN_RATE = 10

export function StepRate() {
  useTeacherStepGuard('rate')
  const router = useRouter()
  const { state, patch } = useTeacherWizard()

  const canContinue = Number(state.hourlyRate) >= MIN_RATE

  return (
    <WizardShell
      step="rate"
      steps={TEACHER_WIZARD_STEPS}
      title="Set your hourly rate"
      subtitle="You can change this anytime from your dashboard."
      onBack={() => router.push('/teacher/onboarding/profile')}
      onNext={() => router.push('/teacher/onboarding/media')}
      nextDisabled={!canContinue}
    >
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="hourlyRate" className="text-sm font-medium text-slate-700">
          Hourly rate (£)
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">£</span>
          <input
            id="hourlyRate"
            name="hourlyRate"
            type="number"
            min={MIN_RATE}
            value={state.hourlyRate}
            onChange={(event) => patch({ hourlyRate: event.target.value })}
            required
            className="w-20 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right text-slate-900 shadow-sm outline-none transition-all hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">Minimum £{MIN_RATE}/hour — covers platform and payment processing costs.</p>
    </WizardShell>
  )
}
