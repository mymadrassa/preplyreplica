'use client'

import { useMemo } from 'react'
import { MushafViewer, type MushafLesson, type MushafRole } from '@preply-clone/mushaf'
import { createBrowserClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'

interface MushafSessionViewProps {
  role: MushafRole
  sessionId: string
  teacherId: string | null
  currentUserId: string
  initialPage: number
  bookingId?: string | null
  lessons?: MushafLesson[]
}

/** App-side adapter: gives the portable Mushaf package this app's Supabase client and toast surface. */
export function MushafSessionView(props: MushafSessionViewProps) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { showToast } = useToast()

  return <MushafViewer supabase={supabase} onError={(message) => showToast('error', message)} {...props} />
}
