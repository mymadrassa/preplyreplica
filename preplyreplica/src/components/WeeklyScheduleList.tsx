'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { WEEKDAY_LABELS } from '@/lib/constants'

type Slot = { id: string; weekday: number; start_time: string; end_time: string }

export function WeeklyScheduleList({ slots }: { slots: Slot[] }) {
  const [query, setQuery] = useState('')

  const filtered = slots.filter((slot) => {
    const haystack = `${WEEKDAY_LABELS[slot.weekday]} ${slot.start_time} ${slot.end_time}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  if (!slots.length) {
    return <p className="text-slate-600">No weekly slots configured yet.</p>
  }

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <span className="sr-only">Search weekly schedule</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by day or time (e.g. Monday, 14:00)"
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
      </label>
      {filtered.length ? (
        <div className="grid max-h-72 gap-3 overflow-y-auto pr-1">
          {filtered.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <p>{WEEKDAY_LABELS[slot.weekday]}: {slot.start_time} — {slot.end_time}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No slots match "{query}".</p>
      )}
    </div>
  )
}
