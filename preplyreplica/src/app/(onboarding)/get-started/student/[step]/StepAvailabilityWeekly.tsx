'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { WeeklySlotPicker } from '@/components/onboarding/WeeklySlotPicker'
import { useWizard } from '@/components/onboarding/WizardProvider'
import { useStepGuard } from '@/components/onboarding/useStepGuard'

export function StepAvailabilityWeekly() {
  useStepGuard('availability-weekly')
  const router = useRouter()
  const { state, patch } = useWizard()

  return (
    <WizardShell
      step="availability-weekly"
      title="When are you usually free?"
      subtitle="Pick the times that work best for your weekly lessons."
      onBack={() => router.push('/get-started/student/availability-now')}
      onNext={() => router.push('/get-started/student/rhythm')}
      nextDisabled={state.weeklySlots.length === 0}
    >
      <WeeklySlotPicker value={state.weeklySlots} onChange={(weeklySlots) => patch({ weeklySlots })} />
    </WizardShell>
  )
}
