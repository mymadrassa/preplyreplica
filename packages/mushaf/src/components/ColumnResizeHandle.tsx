'use client'

import { useRef, useState } from 'react'

interface ColumnResizeHandleProps {
  width: number
  min: number
  max: number
  onResize: (width: number) => void
  /** Called once the drag ends, e.g. to remember the size. */
  onResizeEnd: (width: number) => void
  /** Double-click restores this width. */
  defaultWidth: number
}

// A thin bar on a column's right edge: drag it to make the column narrower or wider.
export function ColumnResizeHandle({ width, min, max, onResize, onResizeEnd, defaultWidth }: ColumnResizeHandleProps) {
  const start = useRef<{ x: number; width: number } | null>(null)
  const latest = useRef(width)
  const [dragging, setDragging] = useState(false)

  const clamp = (value: number) => Math.min(Math.max(value, min), max)

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to resize the summary; double-click to reset"
      title="Drag to resize · double-click to reset"
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        start.current = { x: event.clientX, width }
        setDragging(true)
      }}
      onPointerMove={(event) => {
        if (!start.current) return
        latest.current = clamp(start.current.width + (event.clientX - start.current.x))
        onResize(latest.current)
      }}
      onPointerUp={() => {
        if (!start.current) return
        start.current = null
        setDragging(false)
        onResizeEnd(latest.current)
      }}
      onPointerCancel={() => {
        start.current = null
        setDragging(false)
      }}
      onDoubleClick={() => {
        onResize(defaultWidth)
        onResizeEnd(defaultWidth)
      }}
      className={`absolute -right-3 bottom-0 top-0 z-10 hidden w-3 cursor-ew-resize touch-none rounded-full transition-colors hover:bg-sky-400/40 lg:block ${
        dragging ? 'bg-sky-400/50' : ''
      }`}
    />
  )
}
