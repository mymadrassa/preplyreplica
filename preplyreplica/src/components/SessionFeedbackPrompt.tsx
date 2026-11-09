'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Globe, Lock, MessageSquareHeart, Star, ThumbsUp, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextArea } from '@/components/TextArea'
import { useToast } from '@/components/ToastProvider'
import { CRITERIA, REPORT_REASONS, TEACHER_TAGS, canReport, type FeedbackPromptData, type ReportReason } from '@/lib/sessionFeedback'

function lessonLabel(prompt: FeedbackPromptData) {
  return `${prompt.subject} · ${new Date(prompt.startAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
}

function StarRow({ value, onChange, label, size = 'sm' }: { value: number; onChange: (value: number) => void; label: string; size?: 'sm' | 'lg' }) {
  const [hover, setHover] = useState(0)
  const icon = size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          aria-checked={value === n}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="rounded-full p-0.5 text-amber-500 transition-transform hover:scale-110"
        >
          <Star className={icon} fill={n <= (hover || value) ? 'currentColor' : 'none'} strokeWidth={1.5} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

type Step = 'outcome' | 'ok' | 'report'

/**
 * The post-lesson dialog. First "How did the lesson go?": everything went
 * well (then ratings per criterion; a student also gives overall stars and
 * an optional comment, a teacher can add quick tags), or report a problem,
 * which holds the lesson's payout until our team decides. `start` opens it
 * straight on the report form ("Report a problem" buttons).
 */
export function FeedbackDialog({ prompt, onClose, onDone, start = 'outcome' }: { prompt: FeedbackPromptData; onClose: () => void; onDone: () => void; start?: Step }) {
  const { showToast } = useToast()
  const [step, setStep] = useState<Step>(start)
  const [rating, setRating] = useState(0)
  const [criteria, setCriteria] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [tags, setTags] = useState<string[]>([])
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState<'send' | 'skip' | null>(null)
  const isStudent = prompt.role === 'student'
  const reportOpen = canReport({ start_at: prompt.startAt, end_at: prompt.endAt, status: 'confirmed' })
  const criteriaList = CRITERIA[prompt.role]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function post(path: 'feedback' | 'report', body: unknown) {
    const response = await fetch(`/api/bookings/${prompt.bookingId}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => ({}))
    return response.ok ? null : (result.error as string) || 'Something went wrong. Please try again.'
  }

  async function skip() {
    setBusy('skip')
    const error = await post('feedback', { skip: true })
    setBusy(null)
    if (error) return showToast('error', error)
    onDone()
  }

  async function sendFeedback() {
    if (isStudent && !rating) return showToast('error', 'Choose an overall rating first.')
    if (criteriaList.some((c) => !criteria[c.key])) return showToast('error', 'Rate every point, from 1 to 5 stars.')
    setBusy('send')
    const error = await post('feedback', isStudent ? { rating, criteria, comment: comment.trim() || null, visibility } : { criteria, tags })
    setBusy(null)
    if (error) return showToast('error', error)
    showToast('success', `Thanks! ${prompt.otherName} will see your feedback.`)
    onDone()
  }

  async function sendReport() {
    if (!reason) return showToast('error', 'Choose what happened.')
    if (detail.trim().length < 10) return showToast('error', 'Tell us what happened (a few words at least).')
    setBusy('send')
    const error = await post('report', { reason, detail: detail.trim() })
    setBusy(null)
    if (error) return showToast('error', error)
    showToast('success', 'Thanks, we’ve received your report. Our team will get back to you in your messages.')
    onDone()
  }

  const chip = (tag: { key: string; label: string }, tone: 'good' | 'work') => {
    const on = tags.includes(tag.key)
    const colors = tone === 'good' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-amber-500 bg-amber-50 text-amber-800'
    return (
      <button
        key={tag.key}
        type="button"
        aria-pressed={on}
        onClick={() => setTags((list) => (on ? list.filter((k) => k !== tag.key) : [...list, tag.key]))}
        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? colors : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
      >
        {tag.label}
      </button>
    )
  }

  const title =
    step === 'report' ? 'Report a problem' : step === 'outcome' ? 'How did the lesson go?' : isStudent ? `How was your lesson with ${prompt.otherName}?` : `How did ${prompt.otherName} do?`

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="relative z-10 max-h-[90vh] w-full max-w-md space-y-5 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${step === 'report' ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>
              {step === 'report' ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <MessageSquareHeart className="h-5 w-5" aria-hidden="true" />}
            </span>
            <div>
              <h2 id="feedback-title" className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              <p className="text-sm text-slate-500">
                {lessonLabel(prompt)} · with {prompt.otherName}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {step === 'outcome' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setStep('ok')}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-left transition-colors hover:border-emerald-400"
            >
              <ThumbsUp className="h-6 w-6 flex-shrink-0 text-emerald-600" aria-hidden="true" />
              <span>
                <span className="block font-semibold text-emerald-900">Everything went well</span>
                <span className="block text-sm text-emerald-800">Rate the lesson in a few taps.</span>
              </span>
            </button>
            {reportOpen ? (
              <button
                type="button"
                onClick={() => setStep('report')}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-left transition-colors hover:border-amber-400"
              >
                <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-600" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-amber-900">Report a problem</span>
                  <span className="block text-sm text-amber-800">An absence, a technical problem, a lesson that didn’t happen normally…</span>
                </span>
              </button>
            ) : null}
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={skip} loading={busy === 'skip'} disabled={busy !== null}>
                Skip
              </Button>
            </div>
          </div>
        ) : step === 'ok' ? (
          <>
            {isStudent ? (
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall</p>
                <StarRow value={rating} onChange={setRating} label="Overall rating" size="lg" />
              </div>
            ) : null}

            <ul className="space-y-2">
              {criteriaList.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-700">{c.label}</span>
                  <StarRow value={criteria[c.key] ?? 0} onChange={(value) => setCriteria((current) => ({ ...current, [c.key]: value }))} label={c.label} />
                </li>
              ))}
            </ul>

            {isStudent ? (
              <>
                <TextArea label="Comment (optional)" name="comment" rows={3} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} />
                <div role="radiogroup" aria-label="Who can see it" className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['public', Globe, 'Public', `Shown on ${prompt.otherName}'s profile`],
                      ['private', Lock, 'Private', `Only ${prompt.otherName} and our team`],
                    ] as const
                  ).map(([value, Icon, label, hint]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={visibility === value}
                      onClick={() => setVisibility(value)}
                      className={`rounded-2xl border p-3 text-left transition-colors ${visibility === value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Quick notes for {prompt.otherName} (optional)</p>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Went well</p>
                  <div className="flex flex-wrap gap-2">{TEACHER_TAGS.encouraging.map((tag) => chip(tag, 'good'))}</div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">To work on</p>
                  <div className="flex flex-wrap gap-2">{TEACHER_TAGS.toWorkOn.map((tag) => chip(tag, 'work'))}</div>
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep('outcome')} disabled={busy !== null}>
                Back
              </Button>
              <Button type="button" onClick={sendFeedback} loading={busy === 'send'} disabled={busy !== null}>
                Send
              </Button>
            </div>
          </>
        ) : (
          <>
            <div role="radiogroup" aria-label="What happened" className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={reason === r.key}
                  onClick={() => setReason(r.key)}
                  className={`block w-full rounded-2xl border p-3 text-left transition-colors ${reason === r.key ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className="block text-sm font-semibold text-slate-900">{r.label(prompt.role)}</span>
                  <span className="block text-xs text-slate-500">{r.hint}</span>
                </button>
              ))}
            </div>
            <TextArea label="What happened?" name="detail" rows={4} maxLength={2000} value={detail} onChange={(event) => setDetail(event.target.value)} />
            <p className="text-xs text-slate-500">
              The payment for this lesson is put on hold and our team is notified. We’ll look at what happened and get back to you in your messages.
            </p>
            <div className="flex justify-between gap-2">
              {start === 'outcome' ? (
                <Button type="button" variant="secondary" onClick={() => setStep('outcome')} disabled={busy !== null}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" onClick={sendReport} loading={busy === 'send'} disabled={busy !== null}>
                Send report
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Asks for feedback on the latest ended lesson the user hasn't answered
 * (`initial`, from the layout), or on the lesson named by `?feedback=` right
 * after hanging up the call. Closing it only hides it for now; Send or Skip
 * records the answer.
 */
export function SessionFeedbackPrompt({ initial }: { initial: FeedbackPromptData | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requested = searchParams.get('feedback')
  const [fromCall, setFromCall] = useState<FeedbackPromptData | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!requested) return
    let cancelled = false
    fetch(`/api/bookings/${requested}/feedback`)
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled) setFromCall(result?.prompt ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [requested])

  const prompt = [fromCall, initial].find((p): p is FeedbackPromptData => !!p && !closed.has(p.bookingId)) ?? null
  if (!prompt) return null

  const close = () => setClosed((ids) => new Set(ids).add(prompt.bookingId))
  return (
    <FeedbackDialog
      key={prompt.bookingId}
      prompt={prompt}
      onClose={close}
      onDone={() => {
        close()
        router.refresh()
      }}
    />
  )
}

/** "Give feedback" for a lesson, opening the same dialog (bookings list, follow-up page). */
export function GiveFeedbackButton({ prompt, className = '' }: { prompt: FeedbackPromptData; className?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 ${className}`}>
        <MessageSquareHeart className="h-4 w-4" aria-hidden="true" /> Give feedback
      </button>
      {open ? (
        <FeedbackDialog
          prompt={prompt}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}

/** "Report a problem" for a lesson that ended less than 48 hours ago, opening the dialog on the report form. */
export function ReportProblemButton({ prompt, className = '' }: { prompt: FeedbackPromptData; className?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  if (!canReport({ start_at: prompt.startAt, end_at: prompt.endAt, status: 'confirmed' })) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 ${className}`}>
        <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Report a problem
      </button>
      {open ? (
        <FeedbackDialog
          prompt={prompt}
          start="report"
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
