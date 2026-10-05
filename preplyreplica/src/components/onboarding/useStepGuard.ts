'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from './WizardProvider'

// Guest mode has nothing server-side to key a session off of, so a direct
// deep link into the middle of the wizard (e.g. a bookmarked or shared URL)
// is guarded client-side instead: if the student hasn't picked a course yet,
// every later step bounces back to the start rather than operating on empty
// state.
// `enabled: false` turns the guard off -- used once a step has finished
// successfully and is about to clear the wizard state itself (e.g. after
// account creation), so the resulting empty `courses` doesn't get read as
// "deep-linked with no answers" and bounce the student back to step one.
export function useStepGuard(step: string, enabled = true) {
  const router = useRouter()
  const { state, hydrated } = useWizard()

  useEffect(() => {
    if (!hydrated || !enabled) return
    if (step !== 'course' && state.courses.length === 0) {
      router.replace('/get-started/student/course')
    }
  }, [hydrated, enabled, step, state.courses.length, router])
}
