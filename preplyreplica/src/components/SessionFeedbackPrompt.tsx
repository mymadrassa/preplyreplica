'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Globe, Lock, MessageSquareHeart, Star, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextArea } from '@/components/TextArea'
import { useToast } from '@/components/ToastProvider'
import { TEACHER_TAGS, type FeedbackPromptData } from '@/lib/sessionFeedback'

function lessonLabel(prompt: FeedbackPromptData) {
  return `${prompt.subject} · ${new Date(prompt.startAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
}

/** The feedback form in a dialog: stars, comment and visibility for a student; tags for a teacher. */
export function FeedbackDialog({ prompt, onClose, onDone }: { prompt: FeedbackPromptData; onClose: () => void; onDone: () => void }) {
  const { showToast } = useToast()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [tags, setTags] = useState<string[]>([])
  const [busy, setBusy] = useState<'send' | 'skip' | null>(null)
  const isStudent = prompt.role === 'student'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function submit(skip: boolean) {
    if (!skip && isStudent && !rating) return showToast('error', 'Choose a rating first.')
    if (!skip && !isStudent && !tags.length) return showToast('error', 'Pick at least one tag.')
    setBusy(skip ? 'skip' : 'send')
    const body = skip ? { skip: true } : isStudent ? { rating, comment: comment.trim() || null, visibility } : { tags }
    const response = await fetch(`/api/bookings/${prompt.bookingId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) return showToast('error', result.error || 'Unable to save your feedback.')
    if (!skip) showToast('success', `Thanks! ${prompt.otherName} will see your feedback.`)
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="relative z-10 w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <MessageSquareHeart className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="feedback-title" className="text-lg font-semibold text-slate-900">
                {isStudent ? `How was your lesson with ${prompt.otherName}?` : `How did ${prompt.otherName} do?`}
              </h2>
              <p className="text-sm text-slate-500">{lessonLabel(prompt)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {isStudent ? (
          <>
            <div className="flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value === 1 ? '' : 's'}`}
                  aria-pressed={rating === value}
                  onMouseEnter={() => setHover(value)}
                  onClick={() => setRating(value)}
                  className="rounded-full p-1 text-amber-500 transition-transform hover:scale-110"
                >
                  <Star className="h-8 w-8" fill={value <= (hover || rating) ? 'currentColor' : 'none'} strokeWidth={1.5} aria-hidden="true" />
                </button>
              ))}
            </div>
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

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => submit(true)} loading={busy === 'skip'} disabled={busy !== null}>
            Skip
          </Button>
          <Button type="button" onClick={() => submit(false)} loading={busy === 'send'} disabled={busy !== null}>
            Send
          </Button>
        </div>
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
