'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { SelectionCard } from '@/components/onboarding/SelectionCard'
import { useWizard } from '@/components/onboarding/WizardProvider'
import { useStepGuard } from '@/components/onboarding/useStepGuard'

const OPTIONS = [
  { value: 'now' as const, label: 'Right now', description: "I'm ready to start a lesson today." },
  { value: 'this_week' as const, label: 'This week', description: "I'd like to get started in the next few days." },
  { value: 'flexible' as const, label: "I'm flexible", description: 'No rush — just exploring for now.' },
]

export function StepAvailabilityNow() {
  useStepGuard('availability-now')
  const router = useRouter()
  const { state, patch } = useWizard()

  return (
    <WizardShell
      step="availability-now"
      title="How soon do you want to start?"
      onBack={() => router.push('/get-started/student/course')}
      onNext={() => router.push('/get-started/student/availability-weekly')}
      nextDisabled={!state.immediateAvailability}
    >
      <div className="grid gap-3">
        {OPTIONS.map((option) => (
          <SelectionCard
            key={option.value}
            label={option.label}
            description={option.description}
            selected={state.immediateAvailability === option.value}
            onClick={() => patch({ immediateAvailability: option.value })}
          />
        ))}
      </div>
    </WizardShell>
  )
}
