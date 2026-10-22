import { createServerClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/studio/AppShell'
import type { AppNotification } from '@/components/NotificationBell'
import { diffProfileChanges } from '@/lib/profileEditing'
import { loadTeacherProfileState, type TeacherProfileState } from '@/lib/teacherProfileState'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  let userName: string | null = null
  let avatarUrl: string | null = null
  let notifications: AppNotification[] = []

  if (session?.user?.id) {
    const [{ data: profile }, state] = await Promise.all([
      supabase.from('profiles').select('full_name, email, avatar_url').eq('id', session.user.id).single(),
      loadTeacherProfileState(supabase, session.user.id),
    ])
    userName = profile?.full_name || profile?.email?.split('@')[0] || null
    avatarUrl = profile?.avatar_url ?? null
    notifications = teacherNotifications(state)
  }

  return (
    <AppShell role="teacher" dashboardHref="/teacher/dashboard" userName={userName} avatarUrl={avatarUrl} notifications={notifications}>
      {children}
    </AppShell>
  )
}

// What the bell lists: every mandatory step still missing, a nudge to submit
// once everything is ready, and the state of edits to a live profile.
function teacherNotifications(state: TeacherProfileState | null): AppNotification[] {
  if (!state) {
    return [{ id: 'start', title: 'Finish your teacher profile', description: 'Tell students what you teach to get started.', href: '/teacher/onboarding' }]
  }

  const { readiness, teacher, changes, live, pending } = state
  const items: AppNotification[] = readiness.missing.map((item) => ({ id: item.key, title: item.title, description: item.description, href: item.href }))

  if (readiness.canSubmit && (teacher.status === 'draft' || teacher.status === 'rejected')) {
    items.push({
      id: 'submit',
      title: teacher.status === 'rejected' ? 'Resubmit your profile' : 'Submit your profile for approval',
      description: 'Everything is ready. Send it to our team for review.',
      href: '/teacher/profile/review',
    })
  }

  if (changes?.state === 'draft' && pending && diffProfileChanges(live, pending).length) {
    items.push(
      changes.review_note
        ? {
            id: 'changes-rejected',
            title: 'Your changes weren’t approved',
            description: changes.review_note,
            href: '/teacher/profile/review',
          }
        : {
            id: 'changes-draft',
            title: 'You have changes waiting to be submitted',
            description: 'Send them for review. Your live profile stays visible meanwhile.',
            href: '/teacher/profile/review',
          }
    )
  }
  return items
}
