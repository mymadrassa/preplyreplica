'use client'

import { useEffect, useState } from 'react'
import { loadMushafPage } from './data'
import type { MushafPageData } from './types'

export function useMushafPage(pageNumber: number): { page: MushafPageData | null; loading: boolean } {
  const [state, setState] = useState<{ pageNumber: number; page: MushafPageData | null } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadMushafPage(pageNumber, controller.signal).then((page) => {
      if (!controller.signal.aborted) setState({ pageNumber, page })
    })
    return () => controller.abort()
  }, [pageNumber])

  const ready = state?.pageNumber === pageNumber
  return { page: ready ? state.page : null, loading: !ready }
}
