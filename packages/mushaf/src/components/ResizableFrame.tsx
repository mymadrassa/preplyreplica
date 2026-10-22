'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'mushaf-page-width'
const MIN_WIDTH = 320

// Which border is being dragged: horizontal direction (-1 left, 1 right, 0 none)
// and vertical direction (-1 top, 1 bottom, 0 none).
type Edge = { x: -1 | 0 | 1; y: -1 | 0 | 1; cursor: string; className: string }

const EDGES: Edge[] = [
  { x: -1, y: 0, cursor: 'ew-resize', className: 'left-0 top-4 bottom-4 w-3 -translate-x-1/2' },
  { x: 1, y: 0, cursor: 'ew-resize', className: 'right-0 top-4 bottom-4 w-3 translate-x-1/2' },
  { x: 0, y: -1, cursor: 'ns-resize', className: 'top-0 left-4 right-4 h-3 -translate-y-1/2' },
  { x: 0, y: 1, cursor: 'ns-resize', className: 'bottom-0 left-4 right-4 h-3 translate-y-1/2' },
  { x: -1, y: -1, cursor: 'nwse-resize', className: 'left-0 top-0 h-5 w-5 -translate-x-1/2 -translate-y-1/2' },
  { x: 1, y: 1, cursor: 'nwse-resize', className: 'right-0 bottom-0 h-5 w-5 translate-x-1/2 translate-y-1/2' },
  { x: 1, y: -1, cursor: 'nesw-resize', className: 'right-0 top-0 h-5 w-5 translate-x-1/2 -translate-y-1/2' },
  { x: -1, y: 1, cursor: 'nesw-resize', className: 'left-0 bottom-0 h-5 w-5 -translate-x-1/2 translate-y-1/2' },
]

/**
 * A frame whose borders and corners can be dragged to shrink or grow the page
 * inside it. The page keeps its proportions (its text always fills the width),
 * so every drag ends up as a width: side edges move it directly, top/bottom
 * edges via the page's height-to-width ratio, corners by whichever direction
 * moved more. It stays centred, so a side edge grows on both sides at once.
 * Double-click any border to return to full size. The size is remembered.
 */
export function ResizableFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ edge: Edge; x: number; y: number; width: number; height: number; max: number } | null>(null)

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY))
      if (saved >= MIN_WIDTH) setWidth(saved)
    } catch {
      // storage unavailable: start at full size
    }
  }, [])

  function remember(next: number | null) {
    try {
      if (next === null) window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, String(Math.round(next)))
    } catch {
      // ignore: the size still applies for this visit
    }
  }

  function onPointerDown(edge: Edge, event: React.PointerEvent<HTMLDivElement>) {
    const frame = frameRef.current
    if (!frame) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = frame.getBoundingClientRect()
    drag.current = { edge, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, max: frame.parentElement?.clientWidth ?? rect.width }
    setDragging(true)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    // Centred frame: moving a side edge by dx changes the width by 2*dx.
    const fromX = d.edge.x ? d.width + d.edge.x * 2 * (event.clientX - d.x) : null
    // Bottom/top edge: convert the height change into the matching width.
    const fromY = d.edge.y ? d.width * ((d.height + d.edge.y * (event.clientY - d.y)) / d.height) : null
    const candidates = [fromX, fromY].filter((v): v is number => v !== null)
    const next = candidates.reduce((best, v) => (Math.abs(v - d.width) > Math.abs(best - d.width) ? v : best), candidates[0])
    setWidth(Math.min(Math.max(next, MIN_WIDTH), d.max))
  }

  function onPointerUp() {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    setWidth((current) => {
      remember(current)
      return current
    })
  }

  function reset() {
    setWidth(null)
    remember(null)
  }

  return (
    <div
      ref={frameRef}
      className={`group/frame relative mx-auto max-w-full ${dragging ? 'select-none' : ''}`}
      style={{ width: width ?? '100%' }}
    >
      {children}
      {EDGES.map((edge, i) => (
        <div
          key={i}
          role="separator"
          aria-label="Drag to resize the page; double-click to reset"
          title="Drag to resize · double-click to reset"
          onPointerDown={(event) => onPointerDown(edge, event)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={reset}
          className={`absolute z-30 touch-none rounded-full transition-colors hover:bg-sky-400/40 ${edge.className} ${
            dragging && drag.current?.edge === edge ? 'bg-sky-400/50' : ''
          } ${edge.x && edge.y ? 'opacity-0 group-hover/frame:opacity-100 hover:opacity-100' : ''}`}
          style={{ cursor: edge.cursor }}
        />
      ))}
    </div>
  )
}
