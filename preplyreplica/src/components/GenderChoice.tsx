'use client'

import { GENDERS, type Gender } from '@/lib/gender'

/** "I am: Male / Female", as two large radio cards. Students are matched with teachers of the same gender. */
export function GenderChoice({ value, onChange, label = 'I am' }: { value: Gender | null; onChange: (gender: Gender) => void; label?: string }) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-slate-700">{label}</legend>
      <div role="radiogroup" className="mt-2 grid grid-cols-2 gap-3">
        {GENDERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
              value === option.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
