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

  const canContinue = state.headline.trim().length >= 10 && state.bio.trim().length >= 20

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
        <Input
          label="Headline"
          name="headline"
          value={state.headline}
          onChange={(event) => patch({ headline: event.target.value })}
          placeholder="e.g. Certified Spanish tutor with 5 years of experience"
          required
        />
        <TextArea
          label="Bio"
          name="bio"
          rows={6}
          value={state.bio}
          onChange={(event) => patch({ bio: event.target.value })}
          placeholder="Share your teaching style, experience, and what students can expect from your lessons."
          required
        />
      </div>
    </WizardShell>
  )
}
