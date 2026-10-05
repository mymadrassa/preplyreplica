'use client'

import { useState } from 'react'
import { toPounds } from '@/lib/pricing'

interface EarningsTrendChartProps {
  data: { month: string; amountPence: number }[]
}

const CHART_WIDTH = 600
const CHART_HEIGHT = 200
const BASELINE_Y = 160
const TOP_PADDING = 16
const BAR_COLOR = '#04748f' // brand-600 — single series, so one hue is enough (no categorical palette needed)

/**
 * Monthly earnings trend, hand-rolled inline SVG rather than a charting
 * library — matches this codebase's existing lean-dependency approach and
 * the hand-rolled visuals already in AvailabilityCalendar. Single series, so
 * per the dataviz method: no legend (the heading names it), no number
 * stamped on every bar — just a hover tooltip.
 */
export function EarningsTrendChart({ data }: EarningsTrendChartProps) {
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number } | null>(null)

  const maxPence = Math.max(...data.map((d) => d.amountPence), 1)
  const barWidth = CHART_WIDTH / data.length
  const barPadding = barWidth * 0.3

  const hasAnyEarnings = data.some((d) => d.amountPence > 0)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label="Monthly earnings trend">
        <line x1={0} y1={BASELINE_Y} x2={CHART_WIDTH} y2={BASELINE_Y} stroke="#e2e8f0" strokeWidth={1} />
        {data.map((point, index) => {
          const barHeight = point.amountPence > 0 ? Math.max((point.amountPence / maxPence) * (BASELINE_Y - TOP_PADDING), 4) : 0
          const x = index * barWidth + barPadding / 2
          const width = barWidth - barPadding
          const y = BASELINE_Y - barHeight
          const isHovered = hovered?.index === index

          return (
            <g key={point.month}>
              <rect
                x={x}
                y={y}
                width={width}
                height={barHeight}
                rx={4}
                fill={BAR_COLOR}
                opacity={isHovered ? 1 : 0.85}
                onMouseEnter={(event) => setHovered({ index, x: event.clientX, y: event.clientY })}
                onMouseMove={(event) => setHovered({ index, x: event.clientX, y: event.clientY })}
                onMouseLeave={() => setHovered(null)}
                className="cursor-default transition-opacity"
              />
              {/* Invisible full-height hit target so hovering below a short bar still shows its tooltip. */}
              <rect
                x={x}
                y={TOP_PADDING}
                width={width}
                height={BASELINE_Y - TOP_PADDING}
                fill="transparent"
                onMouseEnter={(event) => setHovered({ index, x: event.clientX, y: event.clientY })}
                onMouseMove={(event) => setHovered({ index, x: event.clientX, y: event.clientY })}
                onMouseLeave={() => setHovered(null)}
                className="cursor-default"
              />
              <text x={x + width / 2} y={BASELINE_Y + 18} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {point.month}
              </text>
            </g>
          )
        })}
      </svg>

      {!hasAnyEarnings ? <p className="mt-1 text-center text-sm text-slate-500">No completed payments yet.</p> : null}

      {hovered ? (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: hovered.x + 14, top: hovered.y + 14 }}
        >
          {data[hovered.index].month}: £{toPounds(data[hovered.index].amountPence).toFixed(2)}
        </div>
      ) : null}
    </div>
  )
}
