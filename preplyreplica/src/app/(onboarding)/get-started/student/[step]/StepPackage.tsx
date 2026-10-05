'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { PackagePicker } from '@/components/onboarding/PackagePicker'
import { useWizard } from '@/components/onboarding/WizardProvider'
import { useStepGuard } from '@/components/onboarding/useStepGuard'

export function StepPackage() {
  useStepGuard('package')
  const router = useRouter()
  const { state, patch } = useWizard()

  return (
    <WizardShell
      step="package"
      title="Choose a monthly package"
      subtitle="You can change or cancel your plan anytime."
      onBack={() => router.push('/get-started/student/rhythm')}
      onNext={() => router.push('/get-started/student/teacher')}
      nextDisabled={!state.packageSize}
    >
      <PackagePicker value={state.packageSize} onChange={(packageSize) => patch({ packageSize })} />
    </WizardShell>
  )
}
