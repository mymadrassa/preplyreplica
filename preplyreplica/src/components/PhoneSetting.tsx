'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { useToast } from '@/components/ToastProvider'
import { normalizePhone, phoneProblem, PHONE_HINT } from '@/lib/phone'
import { PhoneInput } from '@/components/PhoneInput'

/**
 * The signed-in user's private phone number, saved on its own. It's never
 * reviewed or shown publicly, so it stays editable even while a teacher
 * profile is under review.
 */
export function PhoneSetting({ initial, help }: { initial: string | null; help: string }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [phone, setPhone] = useState(initial ?? '')
  const [saving, setSaving] = useState(false)
  const unchanged = (normalizePhone(phone) ?? phone) === (initial ?? '')

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!normalizePhone(phone)) return showToast('error', phoneProblem(phone) ?? PHONE_HINT)
    setSaving(true)
    const response = await fetch('/api/profile/phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const result = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) return showToast('error', result.error || 'Unable to save your phone number.')
    setPhone(result.phone)
    showToast('success', 'Phone number saved.')
    router.refresh()
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <PhoneInput label="WhatsApp number (private)" value={phone} onChange={setPhone} help={help} />
      <Button type="submit" variant="secondary" loading={saving} disabled={unchanged}>
        Save
      </Button>
    </form>
  )
}
