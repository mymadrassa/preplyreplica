import { AlertCircle, CheckCircle2 } from 'lucide-react'

// Error/success text relying on color alone fails colorblind users — this
// pairs the color with an icon so the meaning doesn't depend on hue.
export function FormMessage({ type, className = '', children }: { type: 'error' | 'success'; className?: string; children: React.ReactNode }) {
  const Icon = type === 'error' ? AlertCircle : CheckCircle2
  return (
    <p className={`flex items-start gap-2 text-sm ${type === 'error' ? 'text-red-600' : 'text-emerald-600'} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
