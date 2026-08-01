import Link from 'next/link'
import { Button } from '@/components/Button'
import { AccountMenu } from '@/components/AccountMenu'
import { createServerClient } from '@/lib/supabase/server'

const navLinks = [{ href: '/teachers', label: 'Teachers' }]

const dashboardByRole: Record<string, string> = {
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
  admin: '/admin/dashboard',
}

const profileByRole: Record<string, string> = {
  teacher: '/teacher/onboarding',
}

export async function Navbar() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  let dashboardHref = '/'
  let profileHref: string | undefined
  if (session?.user?.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    const role = (profile as { role: 'student' | 'teacher' | 'admin' } | null)?.role
    dashboardHref = (role && dashboardByRole[role]) || '/'
    profileHref = role ? profileByRole[role] : undefined
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">P</span>
          Preply Clone
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <AccountMenu dashboardHref={dashboardHref} profileHref={profileHref} />
          ) : (
            <>
              <Link href="/auth/login" className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-sm md:inline-flex">
                Login
              </Link>
              <Link href="/auth/register">
                <Button className="hidden md:inline-flex">Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
