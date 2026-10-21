'use client'

import type { ReactNode } from 'react'
import { Icon } from './icons'

interface HintTooltipProps {
  children: ReactNode
  /** Draws attention to the icon (e.g. while a selection is half-made). */
  active?: boolean
}

// An info icon that explains itself on hover or keyboard focus.
export function HintTooltip({ children, active = false }: HintTooltipProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="How selecting works"
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
          active ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-transparent text-slate-500 hover:bg-slate-100'
        }`}
      >
        <Icon name="info" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-64 rounded-xl bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lift group-focus-within:block group-hover:block"
      >
        {children}
      </span>
    </span>
  )
}
