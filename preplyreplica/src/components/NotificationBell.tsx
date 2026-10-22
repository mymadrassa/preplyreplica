'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCircle2, ChevronRight } from 'lucide-react'

export interface AppNotification {
  id: string
  title: string
  description: string
  href: string
}

/** Top-bar bell listing what still needs doing; each item links to where it's fixed. */
export function NotificationBell({ notifications }: { notifications: AppNotification[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const count = notifications.length
  const label = count ? `${count} thing${count === 1 ? '' : 's'} to finish` : 'Notifications'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lift">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            {count ? 'To finish before approval' : 'Notifications'}
          </p>
          {count ? (
            <ul className="max-h-96 overflow-y-auto p-1.5">
              {notifications.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50"
                  >
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">{item.title}</span>
                      <span className="block text-xs text-slate-500">{item.description}</span>
                    </span>
                    <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" /> You&apos;re all set.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
