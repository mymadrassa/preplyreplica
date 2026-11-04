'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { SelectionCard } from '@/components/onboarding/SelectionCard'
import { useWizard } from '@/components/onboarding/WizardProvider'
import { SUBJECTS } from '@/lib/constants'
import { GenderChoice } from '@/components/GenderChoice'

export function StepCourse() {
  const router = useRouter()
  const { state, patch } = useWizard()

  function toggle(subject: string) {
    const next = state.courses.includes(subject) ? state.courses.filter((c) => c !== subject) : [...state.courses, subject]
    patch({ courses: next })
  }

  return (
    <WizardShell
      step="course"
      title="What do you want to learn?"
      subtitle="Pick one or more subjects — you can change this later."
      onNext={() => router.push('/get-started/student/availability-now')}
      nextDisabled={state.courses.length === 0 || !state.gender}
    >
      <div className="mb-6">
        <GenderChoice value={state.gender} onChange={(gender) => patch({ gender, selectedTeacherId: null })} />
        <p className="mt-2 text-xs text-slate-500">You&apos;ll be matched with teachers of the same gender.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SUBJECTS.map((subject) => (
          <SelectionCard key={subject} label={subject} selected={state.courses.includes(subject)} onClick={() => toggle(subject)} />
        ))}
      </div>
    </WizardShell>
  )
}
