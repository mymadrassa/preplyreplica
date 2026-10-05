import Link from 'next/link'
import { WizardProvider } from '@/components/onboarding/WizardProvider'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <WizardProvider>
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">P</span>
            Preply Clone
          </Link>
        </div>
      </header>
      {children}
    </WizardProvider>
  )
}
