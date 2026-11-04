'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpenCheck, ChevronDown, ChevronLeft, ChevronRight, PartyPopper, Plus } from 'lucide-react'
import { HomeworkDoneButton } from '@/components/HomeworkDoneButton'
import { FeedbackTags } from '@/components/FeedbackTags'
import type { HomeworkItem, HomeworkRangeView } from '@/lib/homeworkItems'

interface HomeworkPanelProps {
  items: HomeworkItem[]
  /** The student ticks homework off; the teacher only follows along. */
  canTick: boolean
  /** Label each card with its teacher (the personal Mushaf mixes teachers). */
  showTeacher?: boolean
  goToPage: (page: number) => void
  /** Set when the panel is alone in the side column and carries its hide button. */
  onHide: (() => void) | null
  /** Teacher: opens the homework form for the current lesson. */
  assign?: { href: string; label: string } | null
}

const FADE_MS = 250

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** The cahier de texte as a to-do list, in the Mushaf's side column above the summary cards. */
export function HomeworkPanel({ items: initialItems, canTick, showTeacher = false, goToPage, onHide, assign }: HomeworkPanelProps) {
  const [items, setItems] = useState(initialItems)
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [historyOpen, setHistoryOpen] = useState(false)

  // A just-ticked card stays in the to-do while it fades out, then moves to the history.
  const open = items.filter((item) => !item.doneAt || leaving.has(item.id))
  const done = items.filter((item) => item.doneAt && !leaving.has(item.id)).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!))

  function stopLeaving(id: string) {
    setLeaving((ids) => {
      const next = new Set(ids)
      next.delete(id)
      return next
    })
  }

  function setDone(id: string, doneAt: string | null) {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, doneAt } : item)))
    if (!doneAt) return stopLeaving(id)
    setLeaving((ids) => new Set(ids).add(id))
    window.setTimeout(() => stopLeaving(id), FADE_MS)
  }

  const rangeLine = (label: string, range: HomeworkRangeView | null) =>
    range ? (
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
          <span className="block text-sm text-slate-900">{range.label}</span>
        </span>
        {range.page ? (
          <button
            type="button"
            onClick={() => goToPage(range.page!)}
            title={`Go to page ${range.page}`}
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            p. {range.page}
          </button>
        ) : null}
      </div>
    ) : null

  return (
    <section aria-label="Homework" className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <BookOpenCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Homework
          {open.length ? <span className="rounded-full bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-800">{open.length}</span> : null}
        </p>
        {onHide ? (
          <button type="button" title="Hide summary" aria-label="Hide summary" onClick={onHide} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {assign ? (
        <Link
          href={assign.href}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> {assign.label}
        </Link>
      ) : null}

      {open.length ? (
        <ul className="space-y-2">
          {open.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-all"
              style={{ transitionDuration: `${FADE_MS}ms`, opacity: leaving.has(item.id) ? 0 : 1, transform: leaving.has(item.id) ? 'translateX(-8px)' : undefined }}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs text-slate-500">
                  {showTeacher ? `${item.teacherName} · ` : ''}Lesson of {formatDate(item.lessonAt)}
                </p>
                {rangeLine('Revision', item.revision)}
                {rangeLine('New memorisation', item.memorization)}
                {item.note ? <p className="text-xs text-slate-600">{item.note}</p> : null}
                <FeedbackTags tags={item.feedbackTags} />
              </div>
              {canTick ? (
                <HomeworkDoneButton id={item.id} doneAt={null} onChange={(doneAt) => setDone(item.id, doneAt)} />
              ) : (
                <span className="self-start rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Waiting</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex flex-col items-center gap-1 rounded-xl bg-emerald-50/60 px-3 py-4 text-center text-sm font-medium text-emerald-800">
          <PartyPopper className="h-5 w-5" aria-hidden="true" />
          {canTick ? 'Yay! No homework!' : 'No homework waiting.'}
        </p>
      )}

      {done.length ? (
        <div>
          <button
            type="button"
            onClick={() => setHistoryOpen((value) => !value)}
            aria-expanded={historyOpen}
            className="flex w-full items-center gap-1 rounded-lg px-1 py-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {historyOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
            History ({done.length})
          </button>
          {historyOpen ? (
            <ul className="mt-1 space-y-1.5">
              {done.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-100 px-3 py-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      {showTeacher ? `${item.teacherName} · ` : ''}Lesson of {formatDate(item.lessonAt)} · <span className="text-emerald-700">done {formatDate(item.doneAt!)}</span>
                    </span>
                    {canTick ? <HomeworkDoneButton id={item.id} doneAt={item.doneAt} onChange={(doneAt) => setDone(item.id, doneAt)} /> : null}
                  </div>
                  <p className="mt-0.5 text-slate-600 line-through decoration-slate-300">
                    {[item.revision?.label, item.memorization?.label].filter(Boolean).join(' · ') || item.note}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
