'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizard } from './WizardProvider'

// Guest mode has nothing server-side to key a session off of, so a direct
// deep link into the middle of the wizard (e.g. a bookmarked or shared URL)
// is guarded client-side instead: if the student hasn't picked a course yet,
// every later step bounces back to the start rather than operating on empty
// state.
export function useStepGuard(step: string) {
  const router = useRouter()
  const { state, hydrated } = useWizard()

  useEffect(() => {
    if (!hydrated) return
    if (step !== 'course' && state.courses.length === 0) {
      router.replace('/get-started/student/course')
    }
  }, [hydrated, step, state.courses.length, router])
}
