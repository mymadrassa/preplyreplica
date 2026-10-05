'use client'

import { notFound } from 'next/navigation'
import { StepCourse } from './StepCourse'
import { StepAvailabilityNow } from './StepAvailabilityNow'
import { StepAvailabilityWeekly } from './StepAvailabilityWeekly'
import { StepRhythm } from './StepRhythm'
import { StepPackage } from './StepPackage'
import { StepTeacher } from './StepTeacher'
import { StepAccount } from './StepAccount'

const VALID_STEPS = ['course', 'availability-now', 'availability-weekly', 'rhythm', 'package', 'teacher', 'account'] as const
export type WizardStep = (typeof VALID_STEPS)[number]

export default function StudentWizardStepPage({ params }: { params: { step: string } }) {
  const step = params.step as WizardStep
  if (!VALID_STEPS.includes(step)) {
    notFound()
  }

  switch (step) {
    case 'course':
      return <StepCourse />
    case 'availability-now':
      return <StepAvailabilityNow />
    case 'availability-weekly':
      return <StepAvailabilityWeekly />
    case 'rhythm':
      return <StepRhythm />
    case 'package':
      return <StepPackage />
    case 'teacher':
      return <StepTeacher />
    case 'account':
      return <StepAccount />
    default:
      return notFound()
  }
}
