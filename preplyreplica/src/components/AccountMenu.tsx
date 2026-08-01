'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { LayoutDashboard, LogOut, UserCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

export function AccountMenu({ dashboardHref, profileHref }: { dashboardHref: string; profileHref?: string }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    // Full reload so the root layout's Navbar (a server component) reliably
    // re-renders with the cleared session.
    window.location.href = '/'
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-md"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <UserCircle className="h-5 w-5" aria-hidden="true" />
        </span>
        Account
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.19l3.71-3.96a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-lift">
          <Link href={dashboardHref} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <LayoutDashboard className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Dashboard
          </Link>
          {profileHref ? (
            <Link href={profileHref} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <UserCircle className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Profile
            </Link>
          ) : null}
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
