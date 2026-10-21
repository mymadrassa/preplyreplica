'use client'

import { useEffect } from 'react'
import { Icon } from './icons'

const STORAGE_KEY = 'mushaf-theme'

interface ThemeToggleProps {
  dark: boolean
  onChange: (dark: boolean) => void
}

// Light/dark switch for the Mushaf page only. The choice is remembered in the
// browser; storage can be unavailable (private mode), so it never blocks the toggle.
export function ThemeToggle({ dark, onChange }: ThemeToggleProps) {
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === 'dark') onChange(true)
    } catch {
      // storage unavailable: stay on the default light page
    }
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle() {
    const next = !dark
    onChange(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      // ignore: the page still switches for this visit
    }
  }

  const label = dark ? 'Switch to light page' : 'Switch to dark page'
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={dark}
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
    >
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  )
}
