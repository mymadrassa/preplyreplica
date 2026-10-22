'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, Eye, Lock, Pencil, ShieldAlert } from 'lucide-react'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { Button } from '@/components/Button'
import { useToast } from '@/components/ToastProvider'
import { SubmitForApprovalButton } from '@/components/SubmitForApprovalButton'
import { TeacherDetailsForm, type TeacherDetails } from '@/components/TeacherDetailsForm'
import { diffProfileChanges, type ProfileEditMode, type ReviewedValues } from '@/lib/profileEditing'
import type { TeacherReadiness } from '@/lib/teacherReadiness'
import type { TeacherStatus } from '@/lib/loadTeacherReadiness'
import { pendingDocumentChanges, type DocumentRow } from '@/lib/teacherProfileState'
import { PROFILE_STEPS, PROFILE_STEP_LABELS, type ProfileStep } from './steps'
import { DocumentsStep, PhotoUploader } from './ProfileUploads'

export interface ProfileWizardProps {
  step: ProfileStep
  userId: string
  mode: ProfileEditMode
  status: TeacherStatus
  details: TeacherDetails
  stripeConnected: boolean
  live: ReviewedValues
  pending: ReviewedValues | null
  changesState: 'draft' | 'submitted' | null
  reviewNote: string | null
  documents: DocumentRow[]
  readiness: TeacherReadiness
}

// The teacher's single Profile page. How it behaves follows the edit mode
// (see profileEditMode): editable while not live, locked while under review,
// read-mode-with-Edit once live — where edits to what students see wait in a
// pending copy for review while the approved profile stays live.
export function ProfileWizard(props: ProfileWizardProps) {
  const { step, userId, mode, status, details, stripeConnected, live, pending, changesState, reviewNote, documents, readiness } = props
  const router = useRouter()
  const index = PROFILE_STEPS.indexOf(step)
  const go = (target: ProfileStep) => router.push(`/teacher/profile/${target}`)
  const changes = pending ? diffProfileChanges(live, pending) : []
  const docChanges = pendingDocumentChanges(documents)
  const hasChanges = changes.length > 0 || docChanges.added.length > 0 || docChanges.removed.length > 0

  const done: Record<ProfileStep, boolean> = {
    details: readiness.profile,
    photo: readiness.photo,
    identity: readiness.identity,
    certificates: documents.some((d) => d.kind === 'certificate'),
    payouts: readiness.payouts,
    review: status === 'pending' || status === 'approved' || status === 'suspended',
  }

  const nav = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Profile steps" className="flex flex-wrap gap-2">
          {PROFILE_STEPS.map((s) => (
            <Link
              key={s}
              href={`/teacher/profile/${s}`}
              aria-current={s === step ? 'step' : undefined}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                s === step ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {done[s] ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />}
              {PROFILE_STEP_LABELS[s]}
              {s === 'certificates' ? <span className="text-slate-400">(optional)</span> : null}
            </Link>
          ))}
        </nav>
        <a
          href={`/teachers/${userId}?preview=1`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Preview as a student
        </a>
      </div>
      <ModeBanner mode={mode} status={status} changesState={changesState} hasChanges={hasChanges} reviewNote={reviewNote} />
    </div>
  )

  const shared = {
    step,
    steps: PROFILE_STEPS,
    nav,
    onBack: index > 0 ? () => go(PROFILE_STEPS[index - 1]) : () => router.push('/teacher/dashboard'),
    onNext: index < PROFILE_STEPS.length - 1 ? () => go(PROFILE_STEPS[index + 1]) : () => router.push('/teacher/dashboard'),
    nextLabel: index < PROFILE_STEPS.length - 1 ? `Next: ${PROFILE_STEP_LABELS[PROFILE_STEPS[index + 1]]}` : 'Back to dashboard',
  }

  if (step === 'details') {
    return (
      <WizardShell {...shared} title="Your details" subtitle="What students read about you: headline, bio, subjects, languages, rate and intro video.">
        <DetailsStep mode={mode} details={details} live={live} pending={pending} />
      </WizardShell>
    )
  }

  if (step === 'photo') {
    return (
      <WizardShell {...shared} title="Profile photo" subtitle="A clear, friendly photo of your face. Students see it on your profile and when they book.">
        <PhotoStep mode={mode} userId={userId} live={live.avatar_url} pending={pending && pending.avatar_url !== live.avatar_url ? pending.avatar_url : null} hasPendingCopy={!!pending} />
      </WizardShell>
    )
  }

  if (step === 'identity' || step === 'certificates') {
    const kind = step === 'identity' ? 'identity' : 'certificate'
    return (
      <WizardShell
        {...shared}
        title={kind === 'identity' ? 'ID document' : 'Teaching certificates'}
        subtitle={
          kind === 'identity'
            ? 'A government-issued ID (passport, national ID card or driving licence), front and back if it has two sides. Only used to verify you, never shown publicly.'
            : 'Optional: diplomas, ijazah or teaching certificates. Never shown publicly.'
        }
      >
        <DocumentsStep
          userId={userId}
          kind={kind}
          documents={documents.filter((d) => d.kind === kind)}
          locked={mode === 'locked'}
          reviewed={mode === 'review-edit' && kind === 'identity'}
        />
      </WizardShell>
    )
  }

  if (step === 'payouts') {
    return (
      <WizardShell {...shared} title="Payouts" subtitle="Connect Stripe so you can be paid for lessons. Required before you can submit for approval.">
        <PayoutsStep connected={stripeConnected} />
      </WizardShell>
    )
  }

  return (
    <WizardShell {...shared} title="Review" subtitle={mode === 'review-edit' ? 'Changes to your live profile, waiting to be sent for review.' : 'Everything below must be complete before your profile can go to our team.'}>
      <ReviewStep mode={mode} status={status} readiness={readiness} changes={changes} docChanges={docChanges} changesState={changesState} />
    </WizardShell>
  )
}

function ModeBanner({
  mode,
  status,
  changesState,
  hasChanges,
  reviewNote,
}: {
  mode: ProfileEditMode
  status: TeacherStatus
  changesState: 'draft' | 'submitted' | null
  hasChanges: boolean
  reviewNote: string | null
}) {
  if (mode === 'locked') {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {changesState === 'submitted'
            ? 'Your changes are under review. Your live profile stays as it is, and editing is locked until our team decides.'
            : 'Your profile is under review. Editing is locked until our team decides.'}
        </p>
        <WithdrawButton what={changesState === 'submitted' ? 'changes' : 'profile'} />
      </div>
    )
  }
  if (mode === 'review-edit') {
    return (
      <div className="space-y-2">
        {reviewNote ? (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>
              <strong>Your last changes weren&apos;t approved:</strong> {reviewNote}
            </span>
          </p>
        ) : null}
        {hasChanges ? <PendingChangesBar /> : (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Your profile is {status === 'suspended' ? 'suspended' : 'live'}. Changes to your details or photo need a quick review; your current profile stays visible meanwhile.
          </p>
        )}
      </div>
    )
  }
  return null
}

/** Takes a submission back so it can be edited again; it then has to be resubmitted. */
function WithdrawButton({ what }: { what: 'profile' | 'changes' }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  async function withdraw() {
    const message =
      what === 'profile'
        ? 'Withdraw your profile from review to edit it? It leaves the review queue until you submit it again.'
        : 'Withdraw your changes from review to edit them? Your live profile stays as it is.'
    if (!window.confirm(message)) return
    setBusy(true)
    const response = await fetch('/api/teacher/withdraw', { method: 'POST' })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) return showToast('error', result.error || 'Unable to withdraw.')
    showToast('success', 'Withdrawn. You can edit again, then resubmit.')
    router.refresh()
  }

  return (
    <Button type="button" variant="secondary" onClick={withdraw} loading={busy}>
      <Pencil className="h-4 w-4" aria-hidden="true" /> Withdraw to edit
    </Button>
  )
}

function PendingChangesBar() {
  const router = useRouter()
  const { showToast } = useToast()
  const [busy, setBusy] = useState<'submit' | 'discard' | null>(null)

  async function act(action: 'submit' | 'discard') {
    if (action === 'discard' && !window.confirm('Discard your changes? Your live profile stays as it is.')) return
    setBusy(action)
    const response = await fetch('/api/teacher/changes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    const result = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) return showToast('error', result.error || 'Something went wrong.')
    showToast('success', action === 'submit' ? 'Changes sent for review. Your live profile stays visible meanwhile.' : 'Changes discarded.')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <span>You have changes waiting to be sent for review. Students still see your current profile.</span>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => act('discard')} loading={busy === 'discard'} disabled={busy !== null}>
          Discard
        </Button>
        <Button type="button" onClick={() => act('submit')} loading={busy === 'submit'} disabled={busy !== null}>
          Submit changes
        </Button>
      </div>
    </div>
  )
}

/** Asks before the first edit of a live profile: the change needs review, and the live profile stays meanwhile. */
function ReviewWarningDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(event) => event.key === 'Escape' && onCancel()}>
      <div className="fixed inset-0 bg-slate-900/40" onClick={onCancel} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="review-warning-title" className="relative z-10 w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="review-warning-title" className="text-base font-semibold text-slate-900">
              Changes need a new review
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Your profile is approved. Changes to what students see must be checked by our team again. Your current profile stays visible to students
              until the changes are approved.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Edit anyway
          </Button>
        </div>
      </div>
    </div>
  )
}

/** "Edit" for a live profile: warns first (unless edits are already in progress), then opens the editor. */
function useReviewEdit(hasPendingCopy: boolean) {
  const [editing, setEditing] = useState(false)
  const [warning, setWarning] = useState(false)
  return {
    editing,
    startEdit: () => (hasPendingCopy ? setEditing(true) : setWarning(true)),
    stopEdit: () => setEditing(false),
    dialog: warning ? (
      <ReviewWarningDialog
        onCancel={() => setWarning(false)}
        onConfirm={() => {
          setWarning(false)
          setEditing(true)
        }}
      />
    ) : null,
  }
}

function PendingBadge() {
  return <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Pending review</span>
}

function DetailsStep({ mode, details, live, pending }: { mode: ProfileEditMode; details: TeacherDetails; live: ReviewedValues; pending: ReviewedValues | null }) {
  const router = useRouter()
  const edit = useReviewEdit(!!pending)

  if (mode === 'edit') return <TeacherDetailsForm initial={details} onSaved={() => router.refresh()} />

  // Read mode shows the version that will be live: the pending copy if there is one.
  const shown = pending ?? live
  const changed = new Set(pending ? diffProfileChanges(live, pending).map((c) => c.field) : [])
  if (mode === 'review-edit' && edit.editing) {
    return (
      <TeacherDetailsForm
        initial={{ ...details, ...shown }}
        onCancel={edit.stopEdit}
        onSaved={() => {
          edit.stopEdit()
          router.refresh()
        }}
      />
    )
  }

  const rows: { label: string; value: string; field?: string }[] = [
    { label: 'Headline', value: shown.headline || '—', field: 'headline' },
    { label: 'Bio', value: shown.bio || '—', field: 'bio' },
    { label: 'Subjects', value: shown.subjects.join(', ') || '—', field: 'subjects' },
    { label: 'Languages', value: shown.languages.join(', ') || '—', field: 'languages' },
    { label: 'Hourly rate', value: details.hourly_rate != null ? `£${details.hourly_rate}` : '—' },
    { label: 'Intro video', value: shown.video_url ? 'Added' : 'None', field: 'video_url' },
  ]

  return (
    <div className="space-y-4">
      <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="text-sm text-slate-500">{row.label}</dt>
            <dd className="whitespace-pre-line text-sm text-slate-900">
              {row.value}
              {row.field && changed.has(row.field as never) ? <PendingBadge /> : null}
            </dd>
          </div>
        ))}
      </dl>
      {mode === 'review-edit' ? (
        <Button type="button" variant="secondary" onClick={edit.startEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" /> Edit details
        </Button>
      ) : null}
      {edit.dialog}
    </div>
  )
}

function PhotoStep({ mode, userId, live, pending, hasPendingCopy }: { mode: ProfileEditMode; userId: string; live: string | null; pending: string | null; hasPendingCopy: boolean }) {
  const edit = useReviewEdit(hasPendingCopy)

  if (mode === 'edit') return <PhotoUploader userId={userId} current={live} />
  if (mode === 'review-edit' && edit.editing) return <PhotoUploader userId={userId} current={pending ?? live} onDone={edit.stopEdit} reviewed />

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-end justify-center gap-6">
        <figure className="flex flex-col items-center gap-2">
          <Avatar url={live} />
          <figcaption className="text-xs text-slate-500">{pending ? 'Live now' : 'Your photo'}</figcaption>
        </figure>
        {pending ? (
          <figure className="flex flex-col items-center gap-2">
            <Avatar url={pending} />
            <figcaption className="text-xs text-amber-700">New photo · pending review</figcaption>
          </figure>
        ) : null}
      </div>
      {mode === 'review-edit' ? (
        <Button type="button" variant="secondary" onClick={edit.startEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" /> Change photo
        </Button>
      ) : null}
      {edit.dialog}
    </div>
  )
}

function Avatar({ url }: { url: string | null }) {
  return (
    <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- storage URL */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">No photo</span>}
    </div>
  )
}

function PayoutsStep({ connected }: { connected: boolean }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  if (connected) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Stripe is connected. You can receive payouts.
      </p>
    )
  }

  async function connect() {
    setLoading(true)
    const response = await fetch('/api/teacher/payouts', { method: 'POST' })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.onboardingUrl) {
      setLoading(false)
      return showToast('error', result.error || 'Unable to start Stripe setup.')
    }
    window.location.assign(result.onboardingUrl)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">You&apos;ll be taken to Stripe to add your bank details, then brought back here.</p>
      <Button type="button" onClick={connect} loading={loading}>
        Connect Stripe
      </Button>
    </div>
  )
}

function ReviewStep({
  mode,
  status,
  readiness,
  changes,
  docChanges,
  changesState,
}: {
  mode: ProfileEditMode
  status: TeacherStatus
  readiness: TeacherReadiness
  changes: ReturnType<typeof diffProfileChanges>
  docChanges: ReturnType<typeof pendingDocumentChanges>
  changesState: 'draft' | 'submitted' | null
}) {
  if (mode === 'review-edit' || (mode === 'locked' && changesState === 'submitted')) {
    const idChanged = docChanges.added.length > 0 || docChanges.removed.length > 0
    if (!changes.length && !idChanged) return <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your profile is live and up to date. Nothing waiting for review.</p>
    return (
      <div className="space-y-4">
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {changes.map((change) => (
            <li key={change.field} className="space-y-1 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">{change.label}</p>
              <p className="text-slate-500 line-through">{formatValue(change.field, change.before)}</p>
              <p className="text-slate-900">{formatValue(change.field, change.after)}</p>
            </li>
          ))}
          {idChanged ? (
            <li className="space-y-1 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">ID document</p>
              {docChanges.removed.map((d) => (
                <p key={d.id} className="text-slate-500 line-through">
                  {d.bucket_path.split('/').pop()?.replace(/^\d+-/, '')}
                </p>
              ))}
              {docChanges.added.map((d) => (
                <p key={d.id} className="text-slate-900">
                  {d.bucket_path.split('/').pop()?.replace(/^\d+-/, '')}
                </p>
              ))}
            </li>
          ) : null}
        </ul>
        {changesState === 'submitted' ? (
          <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">Sent for review. Your live profile stays as it is until our team approves.</p>
        ) : (
          <p className="text-sm text-slate-600">Use “Submit changes” above to send them for review, or “Discard” to keep your profile as it is.</p>
        )}
      </div>
    )
  }

  const items = [
    { label: 'Details (bio, subjects, rate)', done: readiness.profile, href: '/teacher/profile/details' },
    { label: 'Profile photo', done: readiness.photo, href: '/teacher/profile/photo' },
    { label: 'ID document', done: readiness.identity, href: '/teacher/profile/identity' },
    { label: 'Payouts (Stripe)', done: readiness.payouts, href: '/teacher/profile/payouts' },
  ]

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50">
              {item.done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" /> : <Circle className="h-5 w-5 text-amber-500" aria-hidden="true" />}
              <span className="flex-1 text-slate-800">{item.label}</span>
              <span className={`text-xs font-medium ${item.done ? 'text-emerald-600' : 'text-amber-600'}`}>{item.done ? 'Done' : 'To do'}</span>
            </Link>
          </li>
        ))}
      </ul>
      {mode === 'locked' ? (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">Submitted. Our team is reviewing your profile.</p>
      ) : readiness.canSubmit ? (
        <div className="flex flex-col items-start gap-2">
          {status === 'rejected' ? <p className="text-sm text-slate-600">Your last submission wasn&apos;t approved. Review your details, then resubmit.</p> : null}
          <SubmitForApprovalButton label={status === 'rejected' ? 'Resubmit for approval' : 'Submit for approval'} />
        </div>
      ) : (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Finish the items marked “To do” to submit your profile for approval.</p>
      )}
    </div>
  )
}

function formatValue(field: string, value: unknown): string {
  if (Array.isArray(value)) return value.join(', ') || '—'
  if (field === 'avatar_url') return value ? 'Photo set' : 'No photo'
  if (field === 'video_url') return value ? String(value) : 'No video'
  return value ? String(value) : '—'
}
