'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { GenderChoice } from '@/components/GenderChoice'
import { useToast } from '@/components/ToastProvider'
import type { Gender } from '@/lib/gender'

/**
 * Blocking, one-time questions for accounts created before signup asked
 * them: first and last name and/or gender, whichever is missing.
 */
export function GenderGate({ role, needsName, needsGender }: { role: 'student' | 'teacher'; needsName: boolean; needsGender: boolean }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const ready = (!needsName || (firstName.trim() && lastName.trim())) && (!needsGender || gender)

  async function save() {
    if (!ready) return
    setSaving(true)
    const response = await fetch('/api/profile/basics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(needsName ? { firstName, lastName } : {}), ...(needsGender ? { gender } : {}) }),
    })
    const result = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) return showToast('error', result.error || 'Unable to save.')
    setDone(true)
    router.refresh()
  }

  if (done) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50" />
      <div role="dialog" aria-modal="true" aria-labelledby="account-gate-title" className="relative z-10 w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="account-gate-title" className="text-lg font-semibold text-slate-900">
              {needsName && needsGender ? 'A couple of quick questions' : 'One quick question'} before you continue
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {needsName ? 'Your name is shown to your ' + (role === 'teacher' ? 'students' : 'teachers') + ' in messages and lessons. ' : ''}
              {needsGender
                ? role === 'teacher'
                  ? 'Lessons are always between a teacher and students of the same gender.'
                  : 'Lessons are always with a teacher of the same gender.'
                : ''}
            </p>
          </div>
        </div>
        {needsName ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="First name" name="firstName" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={60} required />
            <Input label="Last name" name="lastName" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={60} required />
          </div>
        ) : null}
        {needsGender ? (
          <>
            <GenderChoice value={gender} onChange={setGender} label="Gender" />
            <p className="text-xs text-slate-500">Your gender can only be changed by our team afterwards.</p>
          </>
        ) : null}
        <div className="flex justify-end">
          <Button type="button" onClick={save} loading={saving} disabled={!ready}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
