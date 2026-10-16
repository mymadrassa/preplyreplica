'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { getOrCreateConversation } from '@/lib/chat'
import { Button } from '@/components/Button'

export function ChatButton({ studentId, teacherId, teacherName }: { studentId: string; teacherId: string; teacherName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    const supabase = createBrowserClient()
    const result = await getOrCreateConversation(supabase, studentId, teacherId)
    setLoading(false)

    if ('error' in result) {
      setError(result.error)
      return
    }
    router.push(`/student/messages/${result.id}`)
  }

  return (
    <div>
      <Button type="button" variant="secondary" className="w-full" onClick={handleClick} loading={loading}>
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Chat with {teacherName}
      </Button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
