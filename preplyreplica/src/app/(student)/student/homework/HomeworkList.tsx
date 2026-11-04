'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { HomeworkDoneButton } from '@/components/HomeworkDoneButton'
import { FeedbackTags } from '@/components/FeedbackTags'
import type { HomeworkItem, HomeworkRangeView } from '@/lib/homeworkItems'

function dateOf(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' })
}

function HomeworkCard({ item, onChange }: { item: HomeworkItem; onChange: (doneAt: string | null) => void }) {
  const row = (label: string, range: HomeworkRangeView | null) =>
    range ? (
      <div key={label} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="text-slate-900">{range.label}</dd>
        </div>
        {range.page ? (
          <Link href={`/student/mushaf/${item.teacherId}?page=${range.page}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
            <BookOpen className="h-4 w-4" aria-hidden="true" /> Open in Mushaf
          </Link>
        ) : null}
      </div>
    ) : null

  return (
    <li className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-card ${item.doneAt ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{item.teacherName}</p>
          <p className="text-xs text-slate-500">
            Lesson of {dateOf(item.lessonAt)}
            {item.doneAt ? <span className="ml-2 text-emerald-700">· done {dateOf(item.doneAt)}</span> : null}
            {item.unseen && !item.doneAt ? <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 font-semibold text-brand-700">New</span> : null}
          </p>
        </div>
        <HomeworkDoneButton id={item.id} doneAt={item.doneAt} onChange={onChange} />
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        {row('Revision', item.revision)}
        {row('New memorisation', item.memorization)}
      </dl>
      {item.note ? <p className="mt-3 text-sm text-slate-600">{item.note}</p> : null}
      <FeedbackTags tags={item.feedbackTags} className="mt-3" />
    </li>
  )
}

export function HomeworkList({ items: initialItems }: { items: HomeworkItem[] }) {
  const [items, setItems] = useState(initialItems)
  const setDone = (id: string, doneAt: string | null) => setItems((list) => list.map((item) => (item.id === id ? { ...item, doneAt } : item)))
  const open = items.filter((item) => !item.doneAt)
  const done = items.filter((item) => item.doneAt)

  return (
    <>
      {open.length ? (
        <ul className="mt-8 space-y-4">
          {open.map((item) => (
            <HomeworkCard key={item.id} item={item} onChange={(doneAt) => setDone(item.id, doneAt)} />
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-8 text-center font-medium text-emerald-800">Yay! No homework!</p>
      )}
      {done.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Done</h2>
          <ul className="mt-4 space-y-4">
            {done.map((item) => (
              <HomeworkCard key={item.id} item={item} onChange={(doneAt) => setDone(item.id, doneAt)} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
