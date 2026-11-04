'use client'

import { useMemo } from 'react'
import { MushafViewer, type MushafLesson, type MushafRole } from '@preply-clone/mushaf'
import { createBrowserClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { HomeworkPanel } from '@/components/HomeworkPanel'
import type { HomeworkItem } from '@/lib/homeworkItems'

interface MushafSessionViewProps {
  role: MushafRole
  sessionId: string
  teacherId: string | null
  currentUserId: string
  initialPage: number
  bookingId?: string | null
  lessons?: MushafLesson[]
  openAtPage?: number | null
  /** Shows the homework to-do above the summary cards. */
  homework?: { items: HomeworkItem[]; canTick: boolean; showTeacher?: boolean; assign?: { href: string; label: string } | null }
}

/** App-side adapter: gives the portable Mushaf package this app's Supabase client, toast surface and homework panel. */
export function MushafSessionView({ homework, ...props }: MushafSessionViewProps) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { showToast } = useToast()

  return (
    <MushafViewer
      supabase={supabase}
      onError={(message) => showToast('error', message)}
      sidePanelTop={homework ? ({ onHide, goToPage }) => <HomeworkPanel {...homework} onHide={onHide} goToPage={goToPage} /> : undefined}
      {...props}
    />
  )
}
