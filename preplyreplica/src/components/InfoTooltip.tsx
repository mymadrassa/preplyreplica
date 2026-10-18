import { Info } from 'lucide-react'

/** A small inline info icon that reveals a tooltip on hover or keyboard focus. */
export function InfoTooltip({ text }: { text: string }) {
  return (
    <span tabIndex={0} className="group relative inline-flex cursor-help outline-none">
      <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
