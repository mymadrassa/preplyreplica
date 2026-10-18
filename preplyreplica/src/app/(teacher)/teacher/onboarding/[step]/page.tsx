'use client'

import { notFound } from 'next/navigation'
import { TEACHER_WIZARD_STEPS, type TeacherWizardStep } from './steps'
import { StepSubjects } from './StepSubjects'
import { StepLanguages } from './StepLanguages'
import { StepProfile } from './StepProfile'
import { StepRate } from './StepRate'
import { StepMedia } from './StepMedia'
import { StepPayouts } from './StepPayouts'

export default function TeacherOnboardingStepPage({ params }: { params: { step: string } }) {
  const step = params.step as TeacherWizardStep
  if (!TEACHER_WIZARD_STEPS.includes(step)) {
    notFound()
  }

  switch (step) {
    case 'subjects':
      return <StepSubjects />
    case 'languages':
      return <StepLanguages />
    case 'profile':
      return <StepProfile />
    case 'rate':
      return <StepRate />
    case 'media':
      return <StepMedia />
    case 'payouts':
      return <StepPayouts />
    default:
      return notFound()
  }
}
