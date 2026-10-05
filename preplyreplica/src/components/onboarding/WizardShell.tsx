import { Button } from '@/components/Button'

const STEPS = ['course', 'availability-now', 'availability-weekly', 'rhythm', 'package', 'teacher'] as const

export function WizardShell({
  step,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  nextLoading = false,
}: {
  step: (typeof STEPS)[number]
  title: string
  subtitle?: string
  children: React.ReactNode
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  nextLoading?: boolean
}) {
  const currentIndex = STEPS.indexOf(step)
  const progressPercent = ((currentIndex + 1) / STEPS.length) * 100

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col px-4 py-12 sm:px-6">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progressPercent}%` }} />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-500">
        Step {currentIndex + 1} of {STEPS.length}
      </p>

      <h1 className="mt-4 text-3xl font-bold text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-2 text-slate-600">{subtitle}</p> : null}

      <div className="mt-8 flex-1">{children}</div>

      <div className="mt-10 flex items-center justify-between gap-4">
        {onBack ? (
          <Button type="button" variant="secondary" onClick={onBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" onClick={onNext} disabled={nextDisabled} loading={nextLoading}>
          {nextLabel}
        </Button>
      </div>
    </main>
  )
}
