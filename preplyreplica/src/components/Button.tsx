// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/Button.tsx
import clsx from 'clsx'

export function Button({
  children,
  type = 'button',
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-400',
        variant === 'primary' && 'bg-brand-500 text-white hover:bg-brand-600',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
