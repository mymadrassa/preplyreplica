'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { Input } from '@/components/Input'
import { TextArea } from '@/components/TextArea'
import { useTeacherWizard } from '@/components/onboarding/TeacherWizardProvider'
import { useTeacherStepGuard } from '@/components/onboarding/useTeacherStepGuard'
import { TEACHER_WIZARD_STEPS } from './steps'

// Mirrors the server-side zod minimums in /api/teacher/onboard (headline
// >= 10 chars, bio >= 20) so the Next button can't be clicked into a
// guaranteed server rejection.
export function StepProfile() {
  useTeacherStepGuard('profile')
  const router = useRouter()
  const { state, patch } = useTeacherWizard()

  const MIN_HEADLINE = 10
  const MAX_HEADLINE = 100
  const MIN_BIO = 20
  const MAX_BIO = 1000
  const headlineLength = state.headline.trim().length
  const bioLength = state.bio.trim().length
  const canContinue = headlineLength >= MIN_HEADLINE && bioLength >= MIN_BIO

  return (
    <WizardShell
      step="profile"
      steps={TEACHER_WIZARD_STEPS}
      title="Tell students about yourself"
      subtitle="A good headline and bio help students decide to book with you."
      onBack={() => router.push('/teacher/onboarding/languages')}
      onNext={() => router.push('/teacher/onboarding/rate')}
      nextDisabled={!canContinue}
    >
      <div className="grid gap-5">
        <div className="relative">
          <Input
            label="Headline"
            name="headline"
            value={state.headline}
            onChange={(event) => patch({ headline: event.target.value })}
            placeholder="e.g. Certified Spanish tutor with 5 years of experience, specializing in conversational fluency"
            maxLength={MAX_HEADLINE}
            className="pr-28"
            required
          />
          <span className="pointer-events-none absolute bottom-2.5 right-3 rounded-full bg-white px-1.5 text-xs text-slate-400">
            {headlineLength >= MIN_HEADLINE ? `${headlineLength} chars` : `min ${MIN_HEADLINE} characters`}
          </span>
        </div>
        <div className="relative">
          <TextArea
            label="Bio"
            name="bio"
            rows={6}
            value={state.bio}
            onChange={(event) => patch({ bio: event.target.value })}
            placeholder={
              "e.g. Hi, I'm Maria! I've been teaching Spanish for 5 years, helping beginners build real conversational " +
              'confidence. My lessons are relaxed and tailored to your goals, with plenty of speaking practice and ' +
              'real-life scenarios — not just grammar drills. Looking forward to working with you!'
            }
            maxLength={MAX_BIO}
            required
          />
          <span className="pointer-events-none absolute bottom-2.5 right-3 rounded-full bg-white px-1.5 text-xs text-slate-400">
            {bioLength >= MIN_BIO ? `${bioLength} chars` : `min ${MIN_BIO} characters`}
          </span>
        </div>
      </div>
    </WizardShell>
  )
}
