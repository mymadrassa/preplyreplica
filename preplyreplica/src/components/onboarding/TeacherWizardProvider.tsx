'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export interface TeacherWizardState {
  subjects: string[]
  languages: string[]
  headline: string
  bio: string
  hourlyRate: string
  videoUrl: string
  // Set right after a successful submit, once the wizard's other fields
  // have already been reset -- the one piece of state StepPayouts needs
  // to know whether there's a real Stripe setup link to offer.
  onboardingUrl: string | null
}

const EMPTY_STATE: TeacherWizardState = {
  subjects: [],
  languages: [],
  headline: '',
  bio: '',
  hourlyRate: '25',
  videoUrl: '',
  onboardingUrl: null,
}

// Separate storage key from the student wizard's -- a teacher and a student
// account in the same browser shouldn't ever read each other's draft state.
const STORAGE_KEY = 'teacher_onboarding_wizard'

interface TeacherWizardContextValue {
  state: TeacherWizardState
  patch: (partial: Partial<TeacherWizardState>) => void
  reset: () => void
  hydrated: boolean
}

const TeacherWizardContext = createContext<TeacherWizardContextValue | null>(null)

export function TeacherWizardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TeacherWizardState>(EMPTY_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) setState(JSON.parse(stored))
    } catch {
      // Corrupt or inaccessible storage just means starting fresh.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Best-effort persistence; losing it just means re-answering a step.
    }
  }, [state, hydrated])

  function patch(partial: Partial<TeacherWizardState>) {
    setState((prev) => ({ ...prev, ...partial }))
  }

  function reset() {
    setState(EMPTY_STATE)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clean up if storage was never accessible.
    }
  }

  return <TeacherWizardContext.Provider value={{ state, patch, reset, hydrated }}>{children}</TeacherWizardContext.Provider>
}

export function useTeacherWizard() {
  const context = useContext(TeacherWizardContext)
  if (!context) throw new Error('useTeacherWizard must be used within a TeacherWizardProvider')
  return context
}
