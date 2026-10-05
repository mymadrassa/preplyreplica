'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { RhythmPicker } from '@/components/onboarding/RhythmPicker'
import { useWizard } from '@/components/onboarding/WizardProvider'
import { useStepGuard } from '@/components/onboarding/useStepGuard'

export function StepRhythm() {
  useStepGuard('rhythm')
  const router = useRouter()
  const { state, patch } = useWizard()

  return (
    <WizardShell
      step="rhythm"
      title="How many lessons per week?"
      onBack={() => router.push('/get-started/student/availability-weekly')}
      onNext={() => router.push('/get-started/student/package')}
      nextDisabled={!state.rhythm}
    >
      <RhythmPicker value={state.rhythm} onChange={(rhythm) => patch({ rhythm })} />
    </WizardShell>
  )
}
