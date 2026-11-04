'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/Input'
import { normalizePhone, phoneProblem } from '@/lib/phone'

// Mistakes more digits can't fix, so they're worth flagging while typing.
const PERMANENT_MISTAKE = /[^\d\s.\-()/+]/
const EXAMPLE = '+212 6 12 34 56 78'

/**
 * Phone field with live checking: says what's wrong (once the person has
 * left the field, or straight away for a mistake typing can't fix) and
 * confirms a valid number. The same rules run again on the server and in
 * the database.
 */
export function PhoneInput({ value, onChange, help, label = 'WhatsApp number' }: { value: string; onChange: (value: string) => void; help: string; label?: string }) {
  const [touched, setTouched] = useState(false)
  const problem = phoneProblem(value)
  const valid = !!normalizePhone(value)
  const showProblem = !!problem && (touched || PERMANENT_MISTAKE.test(value))

  return (
    <div>
      <Input
        label={label}
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder={`e.g. ${EXAMPLE}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={showProblem || undefined}
        aria-describedby="phone-help"
        className={showProblem ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : valid ? 'border-emerald-400' : ''}
        required
      />
      <p id="phone-help" className={`mt-2 flex items-start gap-1.5 text-xs ${showProblem ? 'text-red-600' : valid ? 'text-emerald-700' : 'text-slate-500'}`}>
        {showProblem ? (
          `${problem} Example: ${EXAMPLE}`
        ) : valid ? (
          <>
            <CheckCircle2 className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" /> {help}
          </>
        ) : (
          `Format: + country code, then your number (e.g. ${EXAMPLE}). ${help}`
        )}
      </p>
    </div>
  )
}
