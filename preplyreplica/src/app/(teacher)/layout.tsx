import { createServerClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/studio/AppShell'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  let userName: string | null = null
  let avatarUrl: string | null = null
  if (session?.user?.id) {
    const { data: profile } = await supabase.from('profiles').select('full_name, email, avatar_url').eq('id', session.user.id).single()
    userName = profile?.full_name || profile?.email?.split('@')[0] || null
    avatarUrl = profile?.avatar_url ?? null
  }

  return (
    <AppShell role="teacher" dashboardHref="/teacher/dashboard" userName={userName} avatarUrl={avatarUrl}>
      {children}
    </AppShell>
  )
}
