'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { Input } from '@/components/Input'
import { useTeacherWizard } from '@/components/onboarding/TeacherWizardProvider'
import { useTeacherStepGuard } from '@/components/onboarding/useTeacherStepGuard'
import { TEACHER_WIZARD_STEPS } from './steps'

export function StepRate() {
  useTeacherStepGuard('rate')
  const router = useRouter()
  const { state, patch } = useTeacherWizard()

  const canContinue = Number(state.hourlyRate) >= 10

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
      <Input
        label="Hourly rate (£)"
        name="hourlyRate"
        type="number"
        min={10}
        value={state.hourlyRate}
        onChange={(event) => patch({ hourlyRate: event.target.value })}
        required
      />
    </WizardShell>
  )
}
