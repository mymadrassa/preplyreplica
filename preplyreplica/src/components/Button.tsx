// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/Button.tsx
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

export function Button({
  children,
  type = 'button',
  variant = 'primary',
  className = '',
  loading = false,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary'; loading?: boolean }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-70',
        variant === 'primary' && 'bg-brand-500 text-white hover:bg-brand-600',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50',
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}
