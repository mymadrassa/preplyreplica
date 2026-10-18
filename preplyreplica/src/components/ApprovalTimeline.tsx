import type { ReactNode } from 'react'
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react'

export type TimelineStepState = 'done' | 'pending' | 'failed' | 'upcoming'

export interface TimelineStep {
  key: string
  title: string
  description: string
  state: TimelineStepState
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

/** Generic step-progress tracker — vertical on small screens, horizontal from `sm` up. Reusable anywhere a multi-step status needs a visual timeline, not specific to teacher approval. */
export function ApprovalTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start">
      {steps.map((step, index) => {
        const style = STATE_STYLES[step.state]
        const isLast = index === steps.length - 1
        return (
          <div
            key={step.key}
            className="relative flex flex-1 items-start gap-3 pb-8 last:pb-0 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center"
          >
            <div className={`relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 ${style.circle}`}>
              {style.icon}
            </div>
            {!isLast ? (
              <>
                <div
                  className={`absolute left-[1.125rem] top-9 h-[calc(100%-2.25rem)] w-0.5 sm:hidden ${style.line}`}
                  aria-hidden="true"
                />
                <div
                  className={`absolute left-1/2 right-[-50%] top-[1.125rem] hidden h-0.5 sm:block ${style.line}`}
                  aria-hidden="true"
                />
              </>
            ) : null}
            <div className="sm:mt-1">
              <p className={`text-sm font-semibold ${style.title}`}>{step.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Builds the 3-step profile → payouts → review timeline from a teacher_profiles row. Shared logic so the dashboard (and anywhere else this gets surfaced) stays consistent with the real approval gate in /api/teacher/validate. */
export function buildTeacherApprovalSteps(teacher: { status: string; stripe_charges_enabled: boolean }): TimelineStep[] {
  const stripeDone = teacher.stripe_charges_enabled

  let reviewState: TimelineStepState
  let reviewDescription: string
  if (teacher.status === 'approved') {
    reviewState = 'done'
    reviewDescription = 'Your profile is live and visible to students.'
  } else if (teacher.status === 'rejected') {
    reviewState = 'failed'
    reviewDescription = 'Your profile was rejected. Update it to be reviewed again.'
  } else if (teacher.status === 'suspended') {
    reviewState = 'failed'
    reviewDescription = 'Your profile has been suspended.'
  } else if (stripeDone) {
    reviewState = 'pending'
    reviewDescription = 'Our team is reviewing your profile.'
  } else {
    reviewState = 'upcoming'
    reviewDescription = 'Finish Stripe setup first — review starts after that.'
  }

  return [
    {
      key: 'profile',
      title: 'Profile submitted',
      description: 'Your subjects, bio, and rate are saved.',
      state: 'done',
    },
    {
      key: 'stripe',
      title: 'Payouts connected',
      description: stripeDone ? 'Stripe is set up — you can receive payouts.' : 'Connect Stripe to receive payouts.',
      state: stripeDone ? 'done' : 'pending',
    },
    {
      key: 'review',
      title: 'Admin review',
      description: reviewDescription,
      state: reviewState,
    },
  ]
}
