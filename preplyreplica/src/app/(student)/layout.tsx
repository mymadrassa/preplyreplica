import { createServerClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/studio/AppShell'
import type { AppNotification } from '@/components/NotificationBell'
import { loadFeedbackDue } from '@/lib/loadFeedbackDue'
import type { FeedbackPromptData } from '@/lib/sessionFeedback'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  let userName: string | null = null
  let avatarUrl: string | null = null
  const notifications: AppNotification[] = []
  let feedbackPrompt: FeedbackPromptData | null = null
  let needsGender = false
  let needsName = false
  if (session?.user?.id) {
    const [{ data: profile }, { data: unseen }, due, { data: feedback }] = await Promise.all([
      supabase.from('profiles').select('full_name, email, avatar_url, phone, gender').eq('id', session.user.id).single(),
      supabase
        .from('lesson_homework')
        .select('id, teacher_profiles(profiles(full_name))')
        .eq('student_id', session.user.id)
        .is('student_seen_at', null)
        .order('created_at', { ascending: false })
        .limit(5),
      loadFeedbackDue(supabase, session.user.id, 'student'),
      supabase
        .from('session_feedback')
        .select('id, author:profiles!session_feedback_author_id_fkey(full_name)')
        .eq('recipient_id', session.user.id)
        .eq('status', 'given')
        .is('recipient_seen_at', null)
        .order('created_at', { ascending: false })
        .limit(5),
    ])
    feedbackPrompt = due
    userName = profile?.full_name || profile?.email?.split('@')[0] || null
    avatarUrl = profile?.avatar_url ?? null
    needsGender = !!profile && !profile.gender
    needsName = !!profile && !profile.full_name?.trim()

    if (profile && !profile.phone) {
      notifications.push({
        id: 'phone',
        title: 'Add your WhatsApp number',
        description: 'Your teachers send your homework to it on WhatsApp.',
        href: '/student/profile',
      })
    }
    for (const entry of unseen ?? []) {
      const teacher = (entry.teacher_profiles as { profiles: { full_name: string | null } | null } | null)?.profiles?.full_name
      notifications.push({
        id: `homework-${entry.id}`,
        title: `New homework from ${teacher || 'your teacher'}`,
        description: 'See what to revise and memorise next.',
        href: '/student/homework',
      })
    }
    for (const entry of feedback ?? []) {
      notifications.push({
        id: `feedback-${entry.id}`,
        title: `${entry.author?.full_name || 'Your teacher'} left feedback on your lesson`,
        description: 'See how your lesson went.',
        href: '/student/bookings',
      })
    }
  }

  return (
    <AppShell role="student" dashboardHref="/student/dashboard" userName={userName} avatarUrl={avatarUrl} notifications={notifications} notificationsHeading="Notifications" feedbackPrompt={feedbackPrompt} needsGender={needsGender} needsName={needsName}>
      {children}
    </AppShell>
  )
}
