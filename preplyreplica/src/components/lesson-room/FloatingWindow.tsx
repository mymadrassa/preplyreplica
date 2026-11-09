'use client'

import { useRef, type ReactNode } from 'react'
import { GripHorizontal } from 'lucide-react'

export interface WindowBox {
  x: number
  y: number
  width: number
}

/** Videos keep a 16:9 shape: only the width is stored, the height follows. */
export const VIDEO_RATIO = 9 / 16
export const MIN_WINDOW_WIDTH = 140
/** The largest a video window can grow: this share of the stage, and never more than MAX_WINDOW_PX wide. */
export const MAX_WINDOW_SHARE = 0.6
export const MAX_WINDOW_PX = 720

export function maxWindowWidth(stage: { width: number; height: number }) {
  return Math.max(MIN_WINDOW_WIDTH, Math.min(MAX_WINDOW_PX, stage.width * MAX_WINDOW_SHARE, (stage.height * MAX_WINDOW_SHARE) / VIDEO_RATIO))
}

/** Keeps a window inside the stage and within the size limits. */
export function clampBox(box: WindowBox, stage: { width: number; height: number }): WindowBox {
  const width = Math.min(Math.max(box.width, MIN_WINDOW_WIDTH), maxWindowWidth(stage))
  const height = width * VIDEO_RATIO
  return {
    width,
    x: Math.min(Math.max(box.x, 0), Math.max(stage.width - width, 0)),
    y: Math.min(Math.max(box.y, 0), Math.max(stage.height - height, 0)),
  }
}

/**
 * A video window floating over the lesson: drag it anywhere in the stage by
 * its top bar, and resize it from its bottom corner (up to a maximum size).
 * Where it sits is the viewer's own choice; it changes nothing for the other side.
 */
export function FloatingWindow({
  box,
  stage,
  label,
  actions,
  onChange,
  onCommit,
  children,
}: {
  box: WindowBox
  stage: { width: number; height: number }
  label: string
  /** Buttons in the top bar (e.g. pin), which don't start a drag. */
  actions?: ReactNode
  onChange: (box: WindowBox) => void
  /** Called once a move or resize ends (e.g. to remember the layout). */
  onCommit: () => void
  children: ReactNode
}) {
  const drag = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; start: WindowBox } | null>(null)

  function begin(mode: 'move' | 'resize', event: React.PointerEvent) {
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    drag.current = { mode, startX: event.clientX, startY: event.clientY, start: box }
  }

  function move(event: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const dx = event.clientX - d.startX
    const dy = event.clientY - d.startY
    if (d.mode === 'move') onChange(clampBox({ ...d.start, x: d.start.x + dx, y: d.start.y + dy }, stage))
    // Resizing follows whichever direction moved more, keeping the video's shape.
    else onChange(clampBox({ ...d.start, width: d.start.width + Math.max(dx, dy / VIDEO_RATIO) }, stage))
  }

  function end(event: React.PointerEvent) {
    if (!drag.current) return
    drag.current = null
    ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    onCommit()
  }

  return (
    <div
      className="absolute z-30 flex flex-col overflow-hidden rounded-2xl bg-slate-800 shadow-2xl ring-1 ring-white/10"
      style={{ left: box.x, top: box.y, width: box.width }}
    >
      <div
        onPointerDown={(event) => begin('move', event)}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        title="Drag to move"
        className="flex h-6 cursor-move touch-none select-none items-center justify-between bg-slate-900/80 px-2 text-[11px] font-medium text-slate-200"
      >
        <span className="flex min-w-0 items-center gap-1">
          <GripHorizontal className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </span>
        {actions ? (
          <span className="flex items-center" onPointerDown={(event) => event.stopPropagation()}>
            {actions}
          </span>
        ) : null}
      </div>
      <div className="relative" style={{ height: box.width * VIDEO_RATIO }}>
        {children}
        <div
          onPointerDown={(event) => begin('resize', event)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          title="Drag to resize"
          aria-label="Resize"
          className="absolute bottom-0 right-0 z-10 h-5 w-5 cursor-nwse-resize touch-none"
          style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.55) 50%)' }}
        />
      </div>
    </div>
  )
}
