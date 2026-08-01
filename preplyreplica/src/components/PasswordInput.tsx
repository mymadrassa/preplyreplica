'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordInput({
  label,
  className = '',
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}</span>
      <div className="relative mt-2">
        <input
          type={visible ? 'text' : 'password'}
          className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 ${className}`}
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
  )
}
