import Link from 'next/link'
import { Button } from '@/components/Button'
import { SignOutButton } from '@/components/SignOutButton'
import { createServerClient } from '@/lib/supabase/server'

const navLinks = [{ href: '/teachers', label: 'Teachers' }]

const dashboardByRole: Record<string, string> = {
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
  admin: '/admin/dashboard',
}

export async function Navbar() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  let dashboardHref = '/'
  if (session?.user?.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    const role = (profile as { role: 'student' | 'teacher' | 'admin' } | null)?.role
    dashboardHref = (role && dashboardByRole[role]) || '/'
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-muted-50/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold text-slate-900">
          Preply Clone
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-slate-700 hover:text-slate-900">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link href={dashboardHref} className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:inline-flex">
                Dashboard
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/auth/login" className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:inline-flex">
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
