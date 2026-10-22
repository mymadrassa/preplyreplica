'use client'

import { useEffect, useState } from 'react'
import { loadMushafPage, loadScriptFonts } from './data'
import type { MushafScript } from './script'
import type { MushafPageData } from './types'

/** The page's words plus whether the chosen script's font is ready (the text itself is shared by every script). */
export function useMushafPage(pageNumber: number, script: MushafScript = 'madinah'): { page: MushafPageData | null; loading: boolean } {
  const [state, setState] = useState<{ key: string; page: MushafPageData | null } | null>(null)
  const key = `${pageNumber}:${script}`

  useEffect(() => {
    const controller = new AbortController()
    loadMushafPage(pageNumber, controller.signal)
      .then(async (page) => (page ? { ...page, fontsReady: await loadScriptFonts(page, script) } : null))
      .then((page) => {
        if (!controller.signal.aborted) setState({ key, page })
      })
    return () => controller.abort()
  }, [pageNumber, script, key])

  const ready = state?.key === key
  return { page: ready ? state.page : null, loading: !ready }
}
