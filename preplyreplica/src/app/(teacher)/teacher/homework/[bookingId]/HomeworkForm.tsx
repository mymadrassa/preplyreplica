'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck, Mail, MessageCircle, RotateCw, Send, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextArea } from '@/components/TextArea'
import { useToast } from '@/components/ToastProvider'
import { validateRange, type AyahRange, type SurahMeta } from '@/lib/homework'

interface Delivery {
  channel: 'whatsapp' | 'email' | null
  status: 'sent' | 'delivered' | 'read' | 'failed' | null
  error: string | null
  sentAt: string | null
  seenAt: string | null
}

interface HomeworkFormProps {
  bookingId: string
  surahs: SurahMeta[]
  studentHasPhone: boolean
  initial: { revision: AyahRange | null; memorization: AyahRange | null; note: string | null } | null
  delivery: Delivery | null
}

const EMPTY: AyahRange = { fromSurah: 0, fromAyah: 1, toSurah: 0, toAyah: 1 }

function RangePicker({ label, value, onChange, surahs }: { label: string; value: AyahRange | null; onChange: (next: AyahRange | null) => void; surahs: SurahMeta[] }) {
  const range = value ?? EMPTY
  const set = (patch: Partial<AyahRange>) => onChange({ ...range, ...patch })
  const versesOf = (id: number) => surahs.find((s) => s.id === id)?.verses ?? 286
  const select = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900'

  const end = (side: 'from' | 'to') => {
    const surahKey = side === 'from' ? 'fromSurah' : 'toSurah'
    const ayahKey = side === 'from' ? 'fromAyah' : 'toAyah'
    return (
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <select
          aria-label={`${label}: ${side} surah`}
          className={select}
          value={range[surahKey] || ''}
          onChange={(event) => {
            const surah = Number(event.target.value)
            // Picking the start surah also starts the end there, the common case.
            set(side === 'from' && (!range.toSurah || range.toSurah < surah) ? { fromSurah: surah, fromAyah: 1, toSurah: surah, toAyah: 1 } : { [surahKey]: surah, [ayahKey]: 1 })
          }}
        >
          <option value="">Surah…</option>
          {surahs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}. {s.name}
            </option>
          ))}
        </select>
        <input
          aria-label={`${label}: ${side} ayah`}
          type="number"
          min={1}
          max={range[surahKey] ? versesOf(range[surahKey]) : undefined}
          disabled={!range[surahKey]}
          value={range[ayahKey]}
          onChange={(event) => set({ [ayahKey]: Number(event.target.value) })}
          className={`${select} disabled:bg-slate-50`}
        />
      </div>
    )
  }

  return (
    <fieldset className="space-y-2">
      <legend className="flex w-full items-center justify-between text-sm font-medium text-slate-700">
        {label}
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="text-xs font-medium text-slate-500 hover:text-slate-700">
            Clear
          </button>
        ) : null}
      </legend>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        {end('from')}
        <span className="text-center text-xs text-slate-400">to</span>
        {end('to')}
      </div>
    </fieldset>
  )
}

function DeliveryLine({ delivery }: { delivery: Delivery }) {
  if (!delivery.sentAt && delivery.status !== 'failed') return null
  const when = delivery.sentAt ? new Date(delivery.sentAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''
  if (delivery.status === 'failed') {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
        <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" /> Not delivered: {delivery.error ?? 'unknown error'}
      </p>
    )
  }
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {delivery.channel === 'whatsapp' ? <MessageCircle className="h-4 w-4" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
      Sent by {delivery.channel === 'whatsapp' ? 'WhatsApp' : 'email'} · {when}
      {delivery.channel === 'whatsapp' && (delivery.status === 'delivered' || delivery.status === 'read') ? (
        <span className="inline-flex items-center gap-1">
          <CheckCheck className="h-4 w-4" aria-hidden="true" /> {delivery.status}
        </span>
      ) : null}
      {delivery.channel === 'email' && delivery.error ? <span className="text-emerald-700/80">({delivery.error})</span> : null}
      {delivery.seenAt ? <span className="text-emerald-700/80">· seen in the app</span> : null}
    </p>
  )
}

export function HomeworkForm({ bookingId, surahs, studentHasPhone, initial, delivery }: HomeworkFormProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [revision, setRevision] = useState<AyahRange | null>(initial?.revision ?? null)
  const [memorization, setMemorization] = useState<AyahRange | null>(initial?.memorization ?? null)
  const [note, setNote] = useState(initial?.note ?? '')
  const [busy, setBusy] = useState<'save' | 'resend' | null>(null)

  const complete = (range: AyahRange | null) => (range && range.fromSurah && range.toSurah ? range : null)

  async function send(resendOnly = false) {
    const ranges = { revision: complete(revision), memorization: complete(memorization) }
    if (!resendOnly) {
      for (const [label, range] of [['Revision', ranges.revision], ['New memorisation', ranges.memorization]] as const) {
        const problem = range ? validateRange(range, surahs) : null
        if (problem) return showToast('error', `${label}: ${problem}`)
      }
      if (!ranges.revision && !ranges.memorization && !note.trim()) return showToast('error', 'Add a revision, a new memorisation or a note.')
    }

    setBusy(resendOnly ? 'resend' : 'save')
    const response = await fetch('/api/homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, ...ranges, note: note.trim() || null, resendOnly }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) return showToast('error', result.error || 'Unable to send the homework.')
    if (result.error) showToast('error', `Saved, but not sent: ${result.error}`)
    else showToast('success', result.channel === 'whatsapp' ? 'Sent on WhatsApp.' : 'Sent by email.')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <RangePicker label="Revision" value={revision} onChange={setRevision} surahs={surahs} />
      <RangePicker label="New memorisation" value={memorization} onChange={setMemorization} surahs={surahs} />
      <TextArea label="Note (optional)" name="note" rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />

      {!studentHasPhone ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This student hasn&apos;t added a phone number yet, so it will be sent by email. They&apos;ve been asked to add one.
        </p>
      ) : null}
      {delivery ? <DeliveryLine delivery={delivery} /> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => send(false)} loading={busy === 'save'} disabled={busy !== null}>
          <Send className="h-4 w-4" aria-hidden="true" /> {initial ? 'Save & send update' : 'Save & send'}
        </Button>
        {initial ? (
          <Button type="button" variant="secondary" onClick={() => send(true)} loading={busy === 'resend'} disabled={busy !== null}>
            <RotateCw className="h-4 w-4" aria-hidden="true" /> Resend
          </Button>
        ) : null}
      </div>
    </div>
  )
}
