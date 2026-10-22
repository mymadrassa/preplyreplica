import type { ReactNode } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react'
import { SubmitForApprovalButton } from '@/components/SubmitForApprovalButton'
import type { TeacherReadiness } from '@/lib/teacherReadiness'
import type { TeacherStatus } from '@/lib/loadTeacherReadiness'

export type TimelineStepState = 'done' | 'pending' | 'failed' | 'upcoming'

export interface TimelineStep {
  key: string
  title: string
  description: string
  state: TimelineStepState
  /** Where this step is done; the step is then a link, so it can be revisited at any time. */
  href?: string
  /** A control shown under the step (e.g. the Submit button). */
  action?: ReactNode
}

const STATE_STYLES: Record<TimelineStepState, { circle: string; line: string; title: string; icon: ReactNode }> = {
  done: {
    circle: 'border-emerald-500 bg-emerald-500 text-white',
    line: 'bg-emerald-500',
    title: 'text-slate-900',
    icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
  },
  pending: {
    circle: 'border-amber-400 bg-amber-50 text-amber-600',
    line: 'bg-slate-200',
    title: 'text-slate-900',
    icon: <Clock className="h-5 w-5" aria-hidden="true" />,
  },
  failed: {
    circle: 'border-red-500 bg-red-50 text-red-600',
    line: 'bg-slate-200',
    title: 'text-slate-900',
    icon: <XCircle className="h-5 w-5" aria-hidden="true" />,
  },
  upcoming: {
    circle: 'border-slate-200 bg-white text-slate-400',
    line: 'bg-slate-200',
    title: 'text-slate-500',
    icon: <Circle className="h-5 w-5" aria-hidden="true" />,
  },
}

/** Generic step-progress tracker — vertical on small screens, horizontal from `sm` up. Steps with an `href` are links. */
export function ApprovalTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start">
      {steps.map((step, index) => {
        const style = STATE_STYLES[step.state]
        const isLast = index === steps.length - 1
        const circle = (
          <div className={`relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 ${style.circle}`}>{style.icon}</div>
        )
        const text = (
          <>
            <p className={`text-sm font-semibold ${style.title} ${step.href ? 'group-hover:text-brand-700 group-hover:underline' : ''}`}>{step.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>
          </>
        )
        return (
          <div key={step.key} className="relative flex flex-1 items-start gap-3 pb-8 last:pb-0 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center">
            {step.href ? (
              <Link href={step.href} className="group relative z-10 flex items-start gap-3 sm:flex-col sm:items-center sm:gap-2" title={`Go to: ${step.title}`}>
                {circle}
                <div className="sm:mt-1">{text}</div>
              </Link>
            ) : (
              <>
                {circle}
                <div className="sm:mt-1">{text}</div>
              </>
            )}
            {!isLast ? (
              <>
                <div className={`absolute left-[1.125rem] top-9 h-[calc(100%-2.25rem)] w-0.5 sm:hidden ${style.line}`} aria-hidden="true" />
                <div className={`absolute left-1/2 right-[-50%] top-[1.125rem] hidden h-0.5 sm:block ${style.line}`} aria-hidden="true" />
              </>
            ) : null}
            {step.action ? <div className="relative z-10 mt-1 sm:mt-2">{step.action}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The teacher's path to approval. Every completion step links to where it's
 * done, so the teacher can go back and forth freely; submitting is only
 * offered once all mandatory steps are complete (see getTeacherReadiness).
 */
export function buildTeacherApprovalSteps({ status, readiness }: { status: TeacherStatus; readiness: TeacherReadiness }): TimelineStep[] {
  const submitted = status === 'pending' || status === 'approved' || status === 'suspended'
  const canResubmit = status === 'draft' || status === 'rejected'

  const submitStep: TimelineStep = submitted
    ? { key: 'submit', title: 'Submit for approval', description: 'Sent to our team.', state: 'done' }
    : readiness.canSubmit && canResubmit
      ? {
          key: 'submit',
          title: status === 'rejected' ? 'Resubmit for approval' : 'Submit for approval',
          description: 'Everything is ready.',
          state: 'pending',
          action: <SubmitForApprovalButton label={status === 'rejected' ? 'Resubmit' : 'Submit'} />,
        }
      : { key: 'submit', title: 'Submit for approval', description: 'Complete the steps before this one.', state: 'upcoming' }

  let reviewState: TimelineStepState = 'upcoming'
  let reviewDescription = 'Starts once you submit.'
  if (status === 'approved') {
    reviewState = 'done'
    reviewDescription = 'Your profile is live and visible to students.'
  } else if (status === 'rejected') {
    reviewState = 'failed'
    reviewDescription = 'Not approved. Update your profile and resubmit.'
  } else if (status === 'suspended') {
    reviewState = 'failed'
    reviewDescription = 'Your profile has been suspended.'
  } else if (status === 'pending') {
    reviewState = 'pending'
    reviewDescription = 'Our team is reviewing your profile.'
  }

  const step = (key: string, title: string, done: boolean, doneText: string, todoText: string, href: string): TimelineStep => ({
    key,
    title,
    description: done ? doneText : todoText,
    state: done ? 'done' : 'pending',
    href,
  })

  return [
    step('profile', 'Profile', readiness.profile, 'Bio, subjects and rate saved.', 'Add your bio, subjects and rate.', '/teacher/profile/details'),
    step('photo', 'Profile photo', readiness.photo, 'Photo added.', 'Add a clear photo of yourself.', '/teacher/profile/photo'),
    step('identity', 'ID document', readiness.identity, 'ID uploaded.', 'Upload a passport, ID card or licence.', '/teacher/profile/identity'),
    step('payouts', 'Payouts', readiness.payouts, 'Stripe connected.', 'Connect Stripe to get paid.', '/teacher/profile/payouts'),
    submitStep,
    { key: 'review', title: 'Admin review', description: reviewDescription, state: reviewState },
  ]
}
