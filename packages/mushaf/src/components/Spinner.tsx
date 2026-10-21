interface SpinnerProps {
  /** Tailwind size classes for the ring; defaults to 1.25rem. */
  className?: string
}

// A ring with one bright arc that turns, in the surrounding text colour.
export function Spinner({ className = 'h-5 w-5' }: SpinnerProps) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} fill="none" role="img" aria-label="Loading">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

interface LoadingBlockProps {
  label?: string
  dark?: boolean
  /** Reserve roughly the space the content will take, so nothing jumps when it arrives. */
  tall?: boolean
}

// A centred spinner with a short caption, for a region that is still loading.
export function LoadingBlock({ label = 'Loading…', dark = false, tall = false }: LoadingBlockProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 rounded-3xl border p-6 text-sm ${tall ? 'min-h-[32rem]' : ''} ${
        dark ? 'border-amber-500/30 bg-[#17140f] text-amber-200' : 'border-slate-200 bg-white text-slate-500'
      }`}
    >
      <Spinner className={`h-9 w-9 ${dark ? 'text-amber-300' : 'text-brand-600'}`} />
      <span>{label}</span>
    </div>
  )
}
