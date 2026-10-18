'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTeacherWizard } from './TeacherWizardProvider'

// Same purpose as the student wizard's useStepGuard: a direct deep-link into
// the middle of the flow with no prior answers bounces back to the start.
// `enabled: false` turns the guard off once a step has finished successfully
// and is about to reset() the wizard state (see StepMedia's final submit).
export function useTeacherStepGuard(step: string, enabled = true) {
  const router = useRouter()
  const { state, hydrated } = useTeacherWizard()

  useEffect(() => {
    if (!hydrated || !enabled) return
    if (step !== 'subjects' && state.subjects.length === 0) {
      router.replace('/teacher/onboarding/subjects')
    }
  }, [hydrated, enabled, step, state.subjects.length, router])
}
