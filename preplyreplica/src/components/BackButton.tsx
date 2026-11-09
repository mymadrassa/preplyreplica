'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * The top bar's back arrow: returns to the previous page, or to `fallbackHref`
 * when the page was opened directly (no previous page in this tab). Hidden on
 * the pages listed in `hideOn` (e.g. the dashboard, where there's nowhere to go back to).
 */
export function BackButton({ fallbackHref, hideOn = [] }: { fallbackHref: string; hideOn?: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  if (hideOn.includes(pathname)) return null

  function goBack() {
    // A fresh tab has a history of 1: there's no previous page to return to.
    if (window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Back to the previous page"
      title="Back"
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
