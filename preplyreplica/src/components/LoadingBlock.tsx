import { Loader2 } from 'lucide-react'

/** A turning ring for a region that is still loading. `inline` suits a single line of text; the default is a centred block. */
export function LoadingBlock({ label = 'Loading…', inline = false }: { label?: string; inline?: boolean }) {
  if (inline) {
    return (
      <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true" />
        {label}
      </span>
    )
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-8 text-sm text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
