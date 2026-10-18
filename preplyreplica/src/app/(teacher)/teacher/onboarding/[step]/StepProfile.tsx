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
  const MIN_BIO = 20
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
        <div>
          <Input
            label="Headline"
            name="headline"
            value={state.headline}
            onChange={(event) => patch({ headline: event.target.value })}
            placeholder="e.g. Certified Spanish tutor with 5 years of experience"
            required
          />
          <p className={`mt-1 text-xs ${headlineLength >= MIN_HEADLINE ? 'text-slate-500' : 'text-amber-600'}`}>
            {headlineLength}/{MIN_HEADLINE} characters minimum
          </p>
        </div>
        <div>
          <TextArea
            label="Bio"
            name="bio"
            rows={6}
            value={state.bio}
            onChange={(event) => patch({ bio: event.target.value })}
            placeholder="Share your teaching style, experience, and what students can expect from your lessons."
            required
          />
          <p className={`mt-1 text-xs ${bioLength >= MIN_BIO ? 'text-slate-500' : 'text-amber-600'}`}>
            {bioLength}/{MIN_BIO} characters minimum
          </p>
        </div>
      </div>
    </WizardShell>
  )
}
