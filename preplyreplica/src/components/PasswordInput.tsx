'use client'

import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'

/**
 * Password field with a show/hide toggle. With `minChars` (creating or
 * changing a password, not logging in) it states the rule up front, turns
 * red with an explicit message when the password is too short once the
 * person leaves the field, and green once it's long enough.
 */
export function PasswordInput({
  label,
  className = '',
  minChars,
  onBlur,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; minChars?: number }) {
  const [visible, setVisible] = useState(false)
  const [touched, setTouched] = useState(false)
  const length = String(props.value ?? '').length
  const tooShort = !!minChars && length < minChars
  const showProblem = tooShort && touched && length > 0
  const ok = !!minChars && !tooShort
  const hintId = props.name ? `${props.name}-hint` : undefined

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        <span>{label}</span>
        <div className="relative mt-2">
          <input
            type={visible ? 'text' : 'password'}
            aria-invalid={showProblem || undefined}
            aria-describedby={minChars ? hintId : undefined}
            onBlur={(event) => {
              setTouched(true)
              onBlur?.(event)
            }}
            className={`w-full rounded-2xl border bg-white px-4 py-3 pr-12 text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:ring-4 ${
              showProblem ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ok ? 'border-emerald-400 focus:border-brand-500 focus:ring-brand-100' : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100'
            } ${className}`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            tabIndex={-1}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
          >
            {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </label>
      {minChars ? (
        <p id={hintId} className={`mt-2 flex items-start gap-1.5 text-xs ${showProblem ? 'text-red-600' : ok ? 'text-emerald-700' : 'text-slate-500'}`}>
          {showProblem ? (
            `Your password is too short: ${length} character${length === 1 ? '' : 's'}, it needs at least ${minChars}.`
          ) : ok ? (
            <>
              <CheckCircle2 className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" /> At least {minChars} characters.
            </>
          ) : (
            `At least ${minChars} characters.`
          )}
        </p>
      ) : null}
    </div>
  )
}
