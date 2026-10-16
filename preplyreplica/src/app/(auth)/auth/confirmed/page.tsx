import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/Button'

const DASHBOARD_BY_ROLE: Record<string, string> = {
  student: '/student/dashboard',
  teacher: '/teacher/dashboard',
  admin: '/admin/dashboard',
}

// Landing page after a successful email-confirmation link, reached via
// /auth/callback. exchangeCodeForSession already signed the user in by the
// time they get here, so this just confirms it happened and sends them
// somewhere useful instead of leaving them on the bare homepage.
export default async function EmailConfirmedPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  let destination = '/auth/login'
  if (session?.user?.id) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    const role = (profile as { role?: string } | null)?.role
    destination = (role && DASHBOARD_BY_ROLE[role]) || '/'
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-3xl font-bold text-slate-900 sm:text-4xl">Email confirmed</h1>
      <p className="mt-3 text-slate-600">Your account is ready. Let's get you started.</p>
      <Link href={destination} className="mt-8 w-full">
        <Button className="w-full">Continue</Button>
      </Link>
    </main>
  )
}
