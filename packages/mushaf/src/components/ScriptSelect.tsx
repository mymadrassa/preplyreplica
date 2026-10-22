'use client'

import { useEffect } from 'react'
import { MUSHAF_SCRIPTS, type MushafScript } from '../script'

const STORAGE_KEY = 'mushaf-script'

interface ScriptSelectProps {
  script: MushafScript
  onChange: (script: MushafScript) => void
}

// Picks the written script (Madinah or IndoPak). It's a personal reading
// preference: a teacher and student can each use their own, since both scripts
// share the page layout and word numbering, so marks line up either way.
export function ScriptSelect({ script, onChange }: ScriptSelectProps) {
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (MUSHAF_SCRIPTS.some((s) => s.value === saved)) onChange(saved as MushafScript)
    } catch {
      // storage unavailable: stay on the default script
    }
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <label className="flex items-center">
      <span className="sr-only">Quran script</span>
      <select
        value={script}
        title="Quran script"
        onChange={(event) => {
          const next = event.target.value as MushafScript
          onChange(next)
          try {
            window.localStorage.setItem(STORAGE_KEY, next)
          } catch {
            // ignore: the script still changes for this visit
          }
        }}
        className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
      >
        {MUSHAF_SCRIPTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
