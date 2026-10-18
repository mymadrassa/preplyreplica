'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { SelectionCard } from '@/components/onboarding/SelectionCard'
import { useTeacherWizard } from '@/components/onboarding/TeacherWizardProvider'
import { SUBJECTS } from '@/lib/constants'
import { TEACHER_WIZARD_STEPS } from './steps'

export function StepSubjects() {
  const router = useRouter()
  const { state, patch } = useTeacherWizard()

  function toggle(subject: string) {
    const next = state.subjects.includes(subject) ? state.subjects.filter((s) => s !== subject) : [...state.subjects, subject]
    patch({ subjects: next })
  }

  return (
    <WizardShell
      step="subjects"
      steps={TEACHER_WIZARD_STEPS}
      title="What do you teach?"
      subtitle="Pick one or more subjects — you can change this later."
      onNext={() => router.push('/teacher/onboarding/languages')}
      nextDisabled={state.subjects.length === 0}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {SUBJECTS.map((subject) => (
          <SelectionCard key={subject} label={subject} selected={state.subjects.includes(subject)} onClick={() => toggle(subject)} />
        ))}
      </div>
    </WizardShell>
  )
}
