'use client'

import { Icon } from './icons'

export const PEN_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#111827']

export type DrawingTool = 'pen' | 'eraser'

interface DrawingToolbarProps {
  /** The active tool, or null when drawing is off and clicks go to the words. */
  tool: DrawingTool | null
  penColor: string
  canUndo: boolean
  dark?: boolean
  onToggleTool: (tool: DrawingTool) => void
  onPenColor: (color: string) => void
  onUndo: () => void
}

// Inline icon (same shape as Lucide's Pencil) so the package has no icon-library dependency.
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  )
}

export function DrawingToolbar({ tool, penColor, canUndo, dark = false, onToggleTool, onPenColor, onUndo }: DrawingToolbarProps) {
  const iconButton = 'flex h-9 w-9 items-center justify-center rounded-full border transition-colors'
  const active = 'border-brand-500 bg-brand-50 text-brand-700'
  const idle = 'border-transparent text-slate-600 hover:bg-slate-100'

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5" role="toolbar" aria-label="Drawing tools">
      <button
        type="button"
        title={tool === 'pen' ? 'Stop drawing' : 'Draw'}
        aria-label={tool === 'pen' ? 'Stop drawing' : 'Draw'}
        aria-pressed={tool === 'pen'}
        onClick={() => onToggleTool('pen')}
        className={`${iconButton} ${tool === 'pen' ? active : idle}`}
      >
        <PencilIcon />
      </button>

      {tool === 'pen'
        ? PEN_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title="Pen colour"
              aria-label={`Pen colour ${color}`}
              onClick={() => onPenColor(color)}
              style={{ backgroundColor: dark && color === '#111827' ? '#f1f5f9' : color }}
              className={`h-6 w-6 rounded-full border-2 ${penColor === color ? 'border-brand-500' : 'border-white ring-1 ring-slate-200'}`}
            />
          ))
        : null}

      <button
        type="button"
        title={tool === 'eraser' ? 'Stop erasing' : 'Eraser: rub out part of your pen strokes'}
        aria-label={tool === 'eraser' ? 'Stop erasing' : 'Eraser'}
        aria-pressed={tool === 'eraser'}
        onClick={() => onToggleTool('eraser')}
        className={`${iconButton} ${tool === 'eraser' ? active : idle}`}
      >
        <Icon name="eraser" />
      </button>

      <button
        type="button"
        title="Undo my last stroke"
        aria-label="Undo my last stroke"
        disabled={!canUndo}
        onClick={onUndo}
        className={`${iconButton} border-transparent text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
      >
        <UndoIcon />
      </button>
    </div>
  )
}
