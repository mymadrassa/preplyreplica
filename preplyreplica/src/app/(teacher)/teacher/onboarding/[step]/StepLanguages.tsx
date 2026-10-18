'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { SelectionCard } from '@/components/onboarding/SelectionCard'
import { useTeacherWizard } from '@/components/onboarding/TeacherWizardProvider'
import { useTeacherStepGuard } from '@/components/onboarding/useTeacherStepGuard'
import { LANGUAGES } from '@/lib/constants'
import { TEACHER_WIZARD_STEPS } from './steps'

export function StepLanguages() {
  useTeacherStepGuard('languages')
  const router = useRouter()
  const { state, patch } = useTeacherWizard()

  function toggle(language: string) {
    const next = state.languages.includes(language) ? state.languages.filter((l) => l !== language) : [...state.languages, language]
    patch({ languages: next })
  }

  return (
    <WizardShell
      step="languages"
      steps={TEACHER_WIZARD_STEPS}
      title="What languages do you teach in?"
      onBack={() => router.push('/teacher/onboarding/subjects')}
      onNext={() => router.push('/teacher/onboarding/profile')}
      nextDisabled={state.languages.length === 0}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {LANGUAGES.map((language) => (
          <SelectionCard key={language} label={language} selected={state.languages.includes(language)} onClick={() => toggle(language)} />
        ))}
      </div>
    </WizardShell>
  )
}
