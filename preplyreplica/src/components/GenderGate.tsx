'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/Button'
import { GenderChoice } from '@/components/GenderChoice'
import { useToast } from '@/components/ToastProvider'
import type { Gender } from '@/lib/gender'

/** Blocking, one-time question for accounts created before gender was asked at signup. */
export function GenderGate({ role }: { role: 'student' | 'teacher' }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [gender, setGender] = useState<Gender | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function save() {
    if (!gender) return
    setSaving(true)
    const response = await fetch('/api/profile/gender', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gender }),
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
      <div role="dialog" aria-modal="true" aria-labelledby="gender-gate-title" className="relative z-10 w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="gender-gate-title" className="text-lg font-semibold text-slate-900">
              One quick question before you continue
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {role === 'teacher'
                ? 'Lessons are always between a teacher and students of the same gender. Students only see teachers of their own gender.'
                : 'Lessons are always with a teacher of the same gender, so we only show you teachers of your gender.'}
            </p>
          </div>
        </div>
        <GenderChoice value={gender} onChange={setGender} />
        <p className="text-xs text-slate-500">This can only be changed by our team afterwards.</p>
        <div className="flex justify-end">
          <Button type="button" onClick={save} loading={saving} disabled={!gender}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
