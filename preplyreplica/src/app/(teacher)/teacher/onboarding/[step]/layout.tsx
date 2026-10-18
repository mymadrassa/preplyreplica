import { TeacherWizardProvider } from '@/components/onboarding/TeacherWizardProvider'

export default function TeacherOnboardingStepLayout({ children }: { children: React.ReactNode }) {
  return <TeacherWizardProvider>{children}</TeacherWizardProvider>
}
