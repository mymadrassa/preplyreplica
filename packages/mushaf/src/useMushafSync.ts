'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  addAnnotation,
  addAnnotations,
  annotationFromRow,
  deleteAnnotation,
  deleteAnnotations,
  listAnnotations,
  type NewAnnotation,
} from './annotations'
import { clampPage } from './data'
import { addStroke, deleteStroke, listStrokes, strokeFromRow, type NewStroke } from './strokes'
import type { MushafClient } from './session'
import type { MushafAnnotation, MushafStroke, MushafTables } from './types'

interface UseMushafSyncOptions {
  supabase: MushafClient
  sessionId: string
  currentUserId: string
  initialPage: number
  /** Stamped on every annotation added through this hook, so marks belong to a lesson. */
  bookingId?: string | null
}

export interface MushafSync {
  currentPage: number
  annotations: MushafAnnotation[]
  strokes: MushafStroke[]
  loading: boolean
  setPage: (page: number) => Promise<void>
  addAnnotation: (annotation: NewAnnotation) => Promise<{ error: string | null }>
  deleteAnnotation: (annotationId: string) => Promise<{ error: string | null }>
  addAnnotations: (annotations: NewAnnotation[]) => Promise<{ error: string | null }>
  deleteAnnotations: (annotationIds: string[]) => Promise<{ error: string | null }>
  addStroke: (stroke: NewStroke) => Promise<{ error: string | null }>
  deleteStroke: (strokeId: string) => Promise<{ error: string | null }>
}

// The single seam between the Mushaf UI and its transport. Everything above
// this hook is transport-agnostic, so swapping Supabase Realtime for Yjs
// later only means rewriting the inside of this function.
export function useMushafSync({ supabase, sessionId, currentUserId, initialPage, bookingId = null }: UseMushafSyncOptions): MushafSync {
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [annotations, setAnnotations] = useState<MushafAnnotation[]>([])
  const [strokes, setStrokes] = useState<MushafStroke[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    listAnnotations(supabase, sessionId).then((rows) => {
      if (!isMounted) return
      setAnnotations(rows)
      setLoading(false)
    })

    listStrokes(supabase, sessionId).then((rows) => {
      if (isMounted) setStrokes(rows)
    })

    const channel = supabase
      .channel(`mushaf:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mushaf_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const next = payload.new as MushafTables['mushaf_sessions']['Row']
          setCurrentPage(next.current_page)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mushaf_annotations', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const next = annotationFromRow(payload.new as MushafTables['mushaf_annotations']['Row'])
          setAnnotations((prev) => (prev.some((a) => a.id === next.id) ? prev : [...prev, next]))
        }
      )
      // Supabase can't filter DELETE events by a non-primary-key column, so
      // this listens to every delete on the table and drops the id locally —
      // a no-op for ids that aren't in this session's list.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mushaf_annotations' }, (payload) => {
        const removedId = (payload.old as { id?: string }).id
        if (removedId) setAnnotations((prev) => prev.filter((a) => a.id !== removedId))
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mushaf_strokes', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const next = strokeFromRow(payload.new as MushafTables['mushaf_strokes']['Row'])
          setStrokes((prev) => (prev.some((x) => x.id === next.id) ? prev : [...prev, next]))
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mushaf_strokes' }, (payload) => {
        const removedId = (payload.old as { id?: string }).id
        if (removedId) setStrokes((prev) => prev.filter((x) => x.id !== removedId))
      })
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [supabase, sessionId])

  const setPage = useCallback(
    async (page: number) => {
      const next = clampPage(page)
      setCurrentPage(next)
      await supabase.from('mushaf_sessions').update({ current_page: next, updated_at: new Date().toISOString() }).eq('id', sessionId)
    },
    [supabase, sessionId]
  )

  const add = useCallback(
    (annotation: NewAnnotation) => addAnnotation(supabase, sessionId, currentUserId, annotation, bookingId),
    [supabase, sessionId, currentUserId, bookingId]
  )

  const addMany = useCallback(
    (list: NewAnnotation[]) => addAnnotations(supabase, sessionId, currentUserId, list, bookingId),
    [supabase, sessionId, currentUserId, bookingId]
  )

  const removeMany = useCallback((ids: string[]) => deleteAnnotations(supabase, ids), [supabase])

  const remove = useCallback((annotationId: string) => deleteAnnotation(supabase, annotationId), [supabase])

  // Strokes are shown the instant they're drawn or erased, without waiting for the
  // server's live-update message (~100ms). A client-made id lets the saved row and
  // the local copy be recognised as the same stroke, so nothing is drawn twice.
  const draw = useCallback(
    async (stroke: NewStroke) => {
      const id = crypto.randomUUID()
      const lesson = stroke.bookingId !== undefined ? stroke.bookingId : bookingId
      const local: MushafStroke = {
        id,
        sessionId,
        authorId: currentUserId,
        bookingId: lesson,
        page: stroke.page,
        color: stroke.color,
        width: stroke.width,
        points: stroke.points,
        createdAt: new Date().toISOString(),
      }
      setStrokes((prev) => [...prev, local])
      const result = await addStroke(supabase, sessionId, currentUserId, stroke, lesson, id)
      if (result.error) setStrokes((prev) => prev.filter((s) => s.id !== id))
      return result
    },
    [supabase, sessionId, currentUserId, bookingId]
  )

  const eraseStroke = useCallback(
    async (strokeId: string) => {
      let removed: MushafStroke | undefined
      setStrokes((prev) => {
        removed = prev.find((s) => s.id === strokeId)
        return prev.filter((s) => s.id !== strokeId)
      })
      const result = await deleteStroke(supabase, strokeId)
      const restore = removed
      if (result.error && restore) setStrokes((prev) => (prev.some((s) => s.id === restore.id) ? prev : [...prev, restore]))
      return result
    },
    [supabase]
  )

  return {
    currentPage,
    annotations,
    strokes,
    loading,
    setPage,
    addAnnotation: add,
    deleteAnnotation: remove,
    addAnnotations: addMany,
    deleteAnnotations: removeMany,
    addStroke: draw,
    deleteStroke: eraseStroke,
  }
}
