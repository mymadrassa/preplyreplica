'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarClock, Gift, Package, X } from 'lucide-react'
import { BookingForm } from '@/components/BookingForm'
import { TRIAL, trialPrice, type Tier } from '@/lib/pricing'

interface BookLessonButtonProps {
  teacher: { id: string; tier: Tier; subjects: string[]; languages: string[] }
  teacherName: string
  /** Signed out visitors are sent to log in first, then come back here. */
  signedIn: boolean
  packageRequired: boolean
  activePackage: { id: string; lessonsLeft: number; expiresAt: string | null } | null
  /** Open straight away (e.g. back from login, or the onboarding wizard's trial link). */
  autoOpen?: boolean
}

/**
 * The teacher page's call to action: "Book your trial lesson" (or "Book a
 * lesson" from a package). It opens the booking window: pick a time, see the
 * price, continue to payment.
 */
export function BookLessonButton({ teacher, teacherName, signedIn, packageRequired, activePackage, autoOpen = false }: BookLessonButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(autoOpen && signedIn)
  const lessonsLeft = activePackage?.lessonsLeft ?? 0
  const needsPackage = packageRequired && lessonsLeft === 0

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  function start() {
    if (needsPackage) {
      document.getElementById('package')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!signedIn) {
      router.push(`/auth/login?next=${encodeURIComponent(`${pathname}?intent=trial`)}`)
      return
    }
    setOpen(true)
  }

  const trial = trialPrice()
  const label = needsPackage ? 'Choose your package' : packageRequired ? 'Book a lesson' : 'Book your trial lesson'
  const Icon = needsPackage ? Package : packageRequired ? CalendarClock : Gift
  const detail = needsPackage
    ? 'After your trial, lessons are booked from a 10-lesson package.'
    : packageRequired
      ? `From your package · ${lessonsLeft} lesson${lessonsLeft === 1 ? '' : 's'} left`
      : `${TRIAL.minutes} minutes · £${trial.studentPays.toFixed(2)} · meet ${teacherName} first`

  return (
    <>
      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <button
          type="button"
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Icon className="h-5 w-5" aria-hidden="true" /> {label}
        </button>
        <p className="text-center text-sm text-slate-500">{detail}</p>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          {/* Never taller than the screen: the content scrolls inside the window. */}
          <div role="dialog" aria-modal="true" aria-label={label} className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col sm:max-h-[calc(100dvh-2rem)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-h-0 overflow-y-auto overscroll-contain rounded-3xl bg-white shadow-2xl">
              <BookingForm teacher={teacher} packageRequired={packageRequired} activePackage={activePackage} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
