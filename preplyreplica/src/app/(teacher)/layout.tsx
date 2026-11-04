import { createServerClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/studio/AppShell'
import type { AppNotification } from '@/components/NotificationBell'
import { loadFeedbackDue } from '@/lib/loadFeedbackDue'
import type { FeedbackPromptData } from '@/lib/sessionFeedback'
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
  let notificationsHeading: string | undefined
  let feedbackPrompt: FeedbackPromptData | null = null
  let needsGender = false

  if (session?.user?.id) {
    const [{ data: profile }, state, { data: finished }, due, { data: feedback }] = await Promise.all([
      supabase.from('profiles').select('full_name, email, avatar_url, gender').eq('id', session.user.id).single(),
      loadTeacherProfileState(supabase, session.user.id),
      supabase
        .from('lesson_homework')
        .select('id, student_id, student:profiles!lesson_homework_student_id_fkey(full_name)')
        .eq('teacher_id', session.user.id)
        .not('done_at', 'is', null)
        .is('teacher_seen_done_at', null)
        .order('done_at', { ascending: false })
        .limit(10),
      loadFeedbackDue(supabase, session.user.id, 'teacher'),
      supabase
        .from('session_feedback')
        .select('id, author_id, author:profiles!session_feedback_author_id_fkey(full_name)')
        .eq('recipient_id', session.user.id)
        .eq('status', 'given')
        .is('recipient_seen_at', null)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    feedbackPrompt = due
    userName = profile?.full_name || profile?.email?.split('@')[0] || null
    avatarUrl = profile?.avatar_url ?? null
    needsGender = !!profile && !profile.gender
    notifications = [
      ...teacherNotifications(state),
      ...(finished ?? []).map((entry) => ({
        id: `homework-done-${entry.id}`,
        title: `${entry.student?.full_name || 'A student'} finished their homework`,
        description: 'See their follow-up.',
        href: `/teacher/students/${entry.student_id}`,
      })),
      ...(feedback ?? []).map((entry) => ({
        id: `feedback-${entry.id}`,
        title: `${entry.author?.full_name || 'A student'} left feedback`,
        description: 'See it on their follow-up page.',
        href: `/teacher/students/${entry.author_id}`,
      })),
    ]
    if (state?.teacher.status === 'approved') notificationsHeading = 'Notifications'
  }

  return (
    <AppShell role="teacher" dashboardHref="/teacher/dashboard" userName={userName} avatarUrl={avatarUrl} notifications={notifications} notificationsHeading={notificationsHeading} feedbackPrompt={feedbackPrompt} needsGender={needsGender}>
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
