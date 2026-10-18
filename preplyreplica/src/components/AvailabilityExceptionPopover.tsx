'use client'

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { useToast } from '@/components/ToastProvider'
import { EXCEPTION_KINDS, TIME_OPTIONS, type ExceptionKind } from '@/lib/constants'

function minutesToTimeValue(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

interface AvailabilityExceptionPopoverProps {
  mode: 'create' | 'edit'
  exceptionId?: string
  date: Date
  startMinutes: number
  endMinutes: number
  kind: ExceptionKind
  position: { x: number; y: number }
  onClose: () => void
  onSaved: () => void
  onPreviewChange: (startMinutes: number, endMinutes: number, kind: ExceptionKind) => void
}

export function AvailabilityExceptionPopover({
  mode,
  exceptionId,
  date,
  startMinutes,
  endMinutes,
  kind,
  position,
  onClose,
  onSaved,
  onPreviewChange,
}: AvailabilityExceptionPopoverProps) {
  const { showToast } = useToast()
  const [startTime, setStartTime] = useState(minutesToTimeValue(startMinutes))
  const [endTime, setEndTime] = useState(minutesToTimeValue(endMinutes))
  const [selectedKind, setSelectedKind] = useState<ExceptionKind>(kind)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const dateLabel = date.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

  function updateStartTime(value: string) {
    setStartTime(value)
    onPreviewChange(Number(value.slice(0, 2)) * 60 + Number(value.slice(3)), Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3)), selectedKind)
  }

  function updateEndTime(value: string) {
    setEndTime(value)
    onPreviewChange(Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3)), Number(value.slice(0, 2)) * 60 + Number(value.slice(3)), selectedKind)
  }

  function updateKind(value: ExceptionKind) {
    setSelectedKind(value)
    onPreviewChange(Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3)), Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3)), value)
  }

  async function handleSave() {
    if (startTime >= endTime) {
      showToast('error', 'End time must be after start time.')
      return
    }
    setSaving(true)
    const body = { exception_date: date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'), start_time: startTime, end_time: endTime, kind: selectedKind }
    const response = await fetch(
      mode === 'create' ? '/api/teacher/availability/exceptions' : `/api/teacher/availability/exceptions/${exceptionId}`,
      {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'create' ? body : { start_time: startTime, end_time: endTime, kind: selectedKind }),
      }
    )
    const result = await response.json()
    setSaving(false)
    if (!response.ok) {
      showToast('error', result.error || 'Unable to save.')
      return
    }
    onSaved()
  }

  async function handleDelete() {
    if (!exceptionId) return
    setDeleting(true)
    const response = await fetch(`/api/teacher/availability/exceptions/${exceptionId}`, { method: 'DELETE' })
    setDeleting(false)
    if (!response.ok) {
      const result = await response.json()
      showToast('error', result.error || 'Unable to delete.')
      return
    }
    onSaved()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-72 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
        style={{ left: Math.min(position.x, window.innerWidth - 300), top: Math.min(position.y, window.innerHeight - 340) }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{dateLabel}</p>
          <button type="button" onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select label="Start" name="start_time" value={startTime} onChange={(event) => updateStartTime(event.target.value)} options={TIME_OPTIONS} />
          <Select label="End" name="end_time" value={endTime} onChange={(event) => updateEndTime(event.target.value)} options={TIME_OPTIONS} />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Kind</span>
          <div className="flex gap-2">
            {EXCEPTION_KINDS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateKind(option.value)}
                className={`flex-1 cursor-pointer rounded-xl border px-2 py-2 text-xs font-medium transition ${
                  selectedKind === option.value ? 'border-slate-900 ring-2 ring-slate-900' : 'border-slate-200'
                }`}
                style={{ backgroundColor: option.bg }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {mode === 'edit' ? (
            <Button type="button" variant="secondary" onClick={handleDelete} loading={deleting} disabled={saving || deleting}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={handleSave} loading={saving} disabled={saving || deleting}>
            Save
          </Button>
        </div>
      </div>
    </>
  )
}
