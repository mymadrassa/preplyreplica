'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsLeft, ChevronsRight, Menu, X, LayoutDashboard, CalendarCheck, Wallet, UserCircle, Search, MessageCircle, type LucideIcon } from 'lucide-react'
import { AccountMenu } from '@/components/AccountMenu'

interface StudioNavItem {
  href: string
  label: string
  icon: LucideIcon
}

export type StudioRole = 'student' | 'teacher' | 'admin'

// Icon components can't cross the server->client boundary as props (they're
// functions, not serializable data), so the nav config lives here, keyed by
// role, and each server layout just passes which role it is.
const NAV_ITEMS_BY_ROLE: Record<StudioRole, StudioNavItem[]> = {
  student: [
    { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/student/bookings', label: 'My bookings', icon: CalendarCheck },
    { href: '/student/messages', label: 'Messages', icon: MessageCircle },
    { href: '/teachers', label: 'Find a teacher', icon: Search },
  ],
  teacher: [
    { href: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/teacher/availability', label: 'Availability', icon: CalendarCheck },
    { href: '/teacher/messages', label: 'Messages', icon: MessageCircle },
    { href: '/teacher/earnings', label: 'Earnings', icon: Wallet },
    { href: '/teacher/onboarding', label: 'Profile', icon: UserCircle },
  ],
  admin: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
}

interface AppShellProps {
  role: StudioRole
  dashboardHref: string
  profileHref?: string
  userName: string | null
  avatarUrl: string | null
  children: React.ReactNode
}

const COLLAPSE_STORAGE_KEY = 'studio-sidebar-collapsed'

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarLinks({ navItems, pathname, collapsed, onNavigate }: { navItems: StudioNavItem[]; pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            {collapsed ? null : <span className="truncate">{item.label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

/** YouTube-Studio-style shell: collapsible left sidebar + slim top bar, used by the student/teacher/admin route groups. Page content renders unchanged inside the content area. */
export function AppShell({ role, dashboardHref, profileHref, userName, avatarUrl, children }: AppShellProps) {
  const pathname = usePathname()
  const navItems = NAV_ITEMS_BY_ROLE[role]
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY)
    if (stored === '1') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 md:flex"
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" aria-hidden="true" /> : <ChevronsLeft className="h-5 w-5" aria-hidden="true" />}
        </button>
        <Link href={dashboardHref} className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">P</span>
          <span className="hidden sm:inline">Preply Clone</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <AccountMenu dashboardHref={dashboardHref} profileHref={profileHref} userName={userName} avatarUrl={avatarUrl} />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] flex-shrink-0 flex-col border-r border-slate-200/80 bg-white transition-all duration-200 md:flex ${collapsed ? 'w-[76px]' : 'w-60'}`}>
          <SidebarLinks navItems={navItems} pathname={pathname} collapsed={collapsed} />
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
            <aside className="relative z-10 flex h-full w-64 flex-col bg-white shadow-lift">
              <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200/80 px-4">
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Menu</span>
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <SidebarLinks navItems={navItems} pathname={pathname} collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
