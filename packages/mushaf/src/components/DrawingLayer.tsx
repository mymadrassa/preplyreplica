'use client'

import { useRef, useState } from 'react'
import { eraseFromStroke, simplifyPoints, type NewStroke } from '../strokes'
import type { MushafStroke } from '../types'
import type { DrawingTool } from './DrawingToolbar'

/** One of your strokes after the eraser has passed over it: the pieces that remain (possibly none). */
export interface StrokeErase {
  stroke: MushafStroke
  pieces: [number, number][][]
}

interface DrawingLayerProps {
  page: number
  strokes: MushafStroke[]
  /** The active tool; null means the layer only displays strokes and lets clicks through to the words. */
  tool: DrawingTool | null
  currentUserId: string
  color: string
  /** Dark page: near-black pen strokes are drawn light so they stay visible. */
  dark?: boolean
  width: number
  onStroke: (stroke: NewStroke) => void
  onErase: (erases: StrokeErase[]) => void
}

const ERASER_RADIUS_PX = 12

// A ring exactly as big as the area the eraser rubs out: a dark line inside a
// light one, so it shows on both the light and dark page.
const ERASER_CURSOR = (() => {
  const size = ERASER_RADIUS_PX * 2
  const c = ERASER_RADIUS_PX
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${c}" cy="${c}" r="${c - 1}" fill="rgba(255,255,255,0.3)" stroke="#ffffff" stroke-width="3"/>` +
    `<circle cx="${c}" cy="${c}" r="${c - 1}" fill="none" stroke="#111827" stroke-width="1.25"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`
})()

function toPath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(x * 1000).toFixed(1)} ${(y * 1000).toFixed(1)}`).join(' ')
}

// Strokes live in a fixed 1000x1000 viewBox stretched over the page
// (preserveAspectRatio="none"), so normalised 0..1 points line up at any size.
export function DrawingLayer({ page, strokes, tool, currentUserId, color, width, dark = false, onStroke, onErase }: DrawingLayerProps) {
  const shown = (c: string) => (dark && c.toLowerCase() === '#111827' ? '#f1f5f9' : c)
  const svgRef = useRef<SVGSVGElement>(null)
  const [live, setLive] = useState<[number, number][] | null>(null)
  const active = tool !== null

  function point(event: React.PointerEvent<SVGSVGElement>): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect()
    const clamp = (n: number) => Math.min(Math.max(n, 0), 1)
    return [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)]
  }

  // Only your own strokes can be rubbed out (the database refuses anyone else's).
  function computeErases(path: [number, number][]): StrokeErase[] {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return []
    const size = { width: rect.width, height: rect.height }
    const erases: StrokeErase[] = []
    for (const stroke of strokes) {
      if (stroke.page !== page || stroke.authorId !== currentUserId) continue
      const pieces = eraseFromStroke(stroke.points, path, size, ERASER_RADIUS_PX)
      if (pieces) erases.push({ stroke, pieces })
    }
    return erases
  }

  function finish() {
    if (live && tool === 'pen' && live.length >= 2) onStroke({ page, color, width, points: simplifyPoints(live) })
    if (live && tool === 'eraser') {
      const erases = computeErases(live)
      if (erases.length) onErase(erases)
    }
    setLive(null)
  }

  // While rubbing, show each touched stroke already cut, so the eraser feels immediate.
  const preview = tool === 'eraser' && live ? new Map(computeErases(live).map((e) => [e.stroke.id, e.pieces])) : null

  const drawable = strokes.filter((stroke) => stroke.page === page)

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      className={`absolute inset-0 h-full w-full ${active ? (tool === 'eraser' ? 'touch-none' : 'cursor-crosshair touch-none') : 'pointer-events-none'}`}
      style={tool === 'eraser' ? { cursor: ERASER_CURSOR } : undefined}
      onPointerDown={(event) => {
        if (!active) return
        event.currentTarget.setPointerCapture(event.pointerId)
        setLive([point(event)])
      }}
      onPointerMove={(event) => {
        if (live) setLive((prev) => (prev ? [...prev, point(event)] : prev))
      }}
      onPointerUp={finish}
      onPointerCancel={() => setLive(null)}
    >
      {drawable.flatMap((stroke) => {
        const pieces = preview?.get(stroke.id) ?? [stroke.points]
        return pieces.map((points, i) => (
          <path
            key={`${stroke.id}-${i}`}
            d={toPath(points)}
            fill="none"
            stroke={shown(stroke.color)}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: stroke.width }}
          />
        ))
      })}
      {tool === 'pen' && live && live.length >= 2 ? (
        <path d={toPath(live)} fill="none" stroke={shown(color)} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: width }} />
      ) : null}
    </svg>
  )
}
