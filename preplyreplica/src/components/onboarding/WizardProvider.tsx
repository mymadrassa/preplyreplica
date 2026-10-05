'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type WeeklySlot = { weekday: number; start_time: string; end_time: string }

export interface WizardState {
  courses: string[]
  immediateAvailability: 'now' | 'this_week' | 'flexible' | null
  weeklySlots: WeeklySlot[]
  rhythm: 1 | 2 | 3 | null
  packageSize: 4 | 8 | 12 | null
  selectedTeacherId: string | null
}

const EMPTY_STATE: WizardState = {
  courses: [],
  immediateAvailability: null,
  weeklySlots: [],
  rhythm: null,
  packageSize: null,
  selectedTeacherId: null,
}

const STORAGE_KEY = 'onboarding_wizard'

interface WizardContextValue {
  state: WizardState
  patch: (partial: Partial<WizardState>) => void
  reset: () => void
  hydrated: boolean
}

const WizardContext = createContext<WizardContextValue | null>(null)

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WizardState>(EMPTY_STATE)
  const [hydrated, setHydrated] = useState(false)

  // Guest-mode state only needs to survive this one sitting, so sessionStorage
  // (tied to the tab) is deliberately preferred over localStorage here.
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

  function patch(partial: Partial<WizardState>) {
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

  return <WizardContext.Provider value={{ state, patch, reset, hydrated }}>{children}</WizardContext.Provider>
}

export function useWizard() {
  const context = useContext(WizardContext)
  if (!context) throw new Error('useWizard must be used within a WizardProvider')
  return context
}
