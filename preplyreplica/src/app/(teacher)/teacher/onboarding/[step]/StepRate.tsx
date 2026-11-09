'use client'

import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { useTeacherStepGuard } from '@/components/onboarding/useTeacherStepGuard'
import { TierRates } from '@/components/TierRates'
import { TIERS, TRIAL } from '@/lib/pricing'
import { TEACHER_WIZARD_STEPS } from './steps'

/** How teachers are paid: the rate comes from the tier (nothing to set), and rises with promotions. */
export function StepRate() {
  useTeacherStepGuard('rate')
  const router = useRouter()

  return (
    <WizardShell
      step="rate"
      steps={TEACHER_WIZARD_STEPS}
      title="How you're paid"
      subtitle="Every teacher starts at the same rate, and earns more as they move up tiers."
      onBack={() => router.push('/teacher/onboarding/profile')}
      onNext={() => router.push('/teacher/onboarding/media')}
    >
      <div className="space-y-4">
        <p className="text-slate-700">
          You start at <strong>£{TIERS.starter.rate.toFixed(2)} per hour</strong> ({TIERS.starter.label}). Your rate rises to £{TIERS.mid.rate.toFixed(2)}, then £
          {TIERS.top.rate.toFixed(2)}, as you move up tiers: promotions happen automatically.
        </p>
        <TierRates current="starter" />
        <p className="text-sm text-slate-500">
          Students first book a {TRIAL.minutes}-minute trial with you (you receive £{TRIAL.teacherReceives.toFixed(2)}, paid 48 hours after the lesson), then continue
          with 10-lesson packages, paid together each month on the 3rd. Students pay My Madrassa, which covers the card fees: you always receive your full rate, with a
          statement for every payout.{' '}
          <a href="/teacher-terms" target="_blank" className="font-medium text-brand-700 underline">
            Teacher terms
          </a>
        </p>
      </div>
    </WizardShell>
  )
}
