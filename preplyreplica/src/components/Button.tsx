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
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
        variant === 'primary' && 'bg-brand-600 text-white shadow-sm shadow-brand-900/10 hover:-translate-y-px hover:bg-brand-700 hover:shadow-md active:translate-y-0',
        variant === 'secondary' && 'border border-slate-200 bg-white text-slate-700 hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm active:translate-y-0',
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}
