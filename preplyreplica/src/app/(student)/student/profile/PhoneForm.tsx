'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useToast } from '@/components/ToastProvider'
import { normalizePhone, phoneProblem, PHONE_HINT } from '@/lib/phone'
import { PhoneInput } from '@/components/PhoneInput'

export function PhoneForm({ initialName, initialPhone }: { initialName: string; initialPhone: string }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [fullName, setFullName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [saving, setSaving] = useState(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!normalizePhone(phone)) return showToast('error', phoneProblem(phone) ?? PHONE_HINT)
    setSaving(true)
    const response = await fetch('/api/profile/phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, fullName }),
    })
    const result = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) return showToast('error', result.error || 'Unable to save.')
    setPhone(result.phone)
    showToast('success', 'Profile saved.')
    router.refresh()
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Input label="Full name" name="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={120} />
      <PhoneInput value={phone} onChange={setPhone} help="Your homework is sent to it on WhatsApp. Never shown to your teachers." />
      <Button type="submit" loading={saving}>
        Save
      </Button>
    </form>
  )
}
