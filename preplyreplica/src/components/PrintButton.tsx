'use client'

import { Printer } from 'lucide-react'

/** Opens the browser's print dialog, where "Save as PDF" downloads the page. Hidden on the printout itself. */
export function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden="true" /> {label}
    </button>
  )
}
