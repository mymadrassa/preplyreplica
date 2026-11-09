'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ConnectionState, Track } from 'livekit-client'
import {
  ConnectionQualityIndicator,
  ParticipantTile,
  TrackToggle,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useRemoteParticipants,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react'
import { BookOpen, LayoutGrid, LogOut, PanelRightClose, PanelRightOpen, Pin, PinOff, WifiOff } from 'lucide-react'
import { FloatingWindow, VIDEO_RATIO, clampBox, type WindowBox } from './FloatingWindow'

interface RoomStageProps {
  role: 'teacher' | 'student'
  otherPartyName: string
  onLeave: () => void
  /** The shared Mushaf, rendered in the centre. */
  mushaf: React.ReactNode
}

type Mode = 'mushaf' | 'video'
type Who = 'remote' | 'local'

/** Each person's own layout, kept in their browser: changing it changes nothing for the other side. */
interface Layout {
  sidebarOpen: boolean
  sidebarWidth: number
  pinned: Record<Who, boolean>
  /** Where the pinned videos float while the sidebar is closed. */
  windows: Record<Who, WindowBox> | null
}

const LAYOUT_KEY = 'lesson-room-layout'
const GAP = 16
const SIDEBAR = { default: 300, min: 200, max: 560, share: 0.45 }

const roundButton =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40'

/** Where floating videos start: the first top right, the next just below it. */
function defaultWindows(stage: { width: number; height: number }): Record<Who, WindowBox> {
  const remoteWidth = Math.min(320, stage.width * 0.4)
  const localWidth = Math.min(220, stage.width * 0.3)
  const remote = clampBox({ width: remoteWidth, x: stage.width - remoteWidth - GAP, y: GAP }, stage)
  const local = clampBox({ width: localWidth, x: stage.width - localWidth - GAP, y: remote.y + remote.width * VIDEO_RATIO + 24 + GAP }, stage)
  return { remote, local }
}

function loadLayout(role: 'teacher' | 'student', narrow: boolean): Layout {
  // By default the teacher's video is the pinned one (yours if you're the teacher, the other person's otherwise).
  const fallback: Layout = { sidebarOpen: !narrow, sidebarWidth: SIDEBAR.default, pinned: { remote: role === 'student', local: role === 'teacher' }, windows: null }
  try {
    const saved = JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? 'null') as Partial<Layout> | null
    if (!saved) return fallback
    return {
      sidebarOpen: typeof saved.sidebarOpen === 'boolean' ? saved.sidebarOpen : fallback.sidebarOpen,
      sidebarWidth: typeof saved.sidebarWidth === 'number' ? saved.sidebarWidth : fallback.sidebarWidth,
      pinned: saved.pinned ?? fallback.pinned,
      windows: saved.windows ?? null,
    }
  } catch {
    return fallback
  }
}

/**
 * Inside the room, filling the window exactly (the page itself never scrolls):
 * the Mushaf with its toolbar (or a shared screen, or both videos in video
 * mode) scrolls inside its own area; the videos sit in a sidebar on the
 * right, opened and closed from its top corner. Open, they're stacked there
 * (resized by dragging the sidebar's edge); closed, it shrinks to a thin bar
 * and the pinned videos float over the Mushaf, where they can be moved and
 * resized. The controls sit in a bar along the bottom.
 */
export function RoomStage({ role, otherPartyName, onLeave, mushaf }: RoomStageProps) {
  const [mode, setMode] = useState<Mode>('mushaf')
  const [showShare, setShowShare] = useState(true)
  const connection = useConnectionState()
  const remotes = useRemoteParticipants()

  const cameras = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false })
  const shares = useTracks([Track.Source.ScreenShare]).filter(isTrackReference)
  const tracks: Record<Who, TrackReferenceOrPlaceholder | undefined> = {
    remote: cameras.find((t) => !t.participant.isLocal),
    local: cameras.find((t) => t.participant.isLocal),
  }
  const share = shares[0]
  const labelOf = (who: Who) =>
    who === 'local' ? 'You' : tracks.remote?.participant.name || (role === 'teacher' ? 'Your student' : 'Your teacher')
  // The teacher's video first, in the sidebar.
  const order: Who[] = role === 'teacher' ? ['local', 'remote'] : ['remote', 'local']

  // The area the Mushaf (and floating videos) occupy, measured so videos stay inside it.
  const stageRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<{ width: number; height: number } | null>(null)
  const [layout, setLayout] = useState<Layout | null>(null)

  useEffect(() => {
    setLayout(loadLayout(role, window.innerWidth < 768))
  }, [role])

  useLayoutEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setStage({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Floating videos: placed on first use, and kept inside the area when it shrinks.
  useEffect(() => {
    if (!stage?.width || !layout || layout.sidebarOpen) return
    setLayout((current) => {
      if (!current) return current
      const windows = current.windows
        ? { remote: clampBox(current.windows.remote, stage), local: clampBox(current.windows.local, stage) }
        : defaultWindows(stage)
      return { ...current, windows }
    })
    // Only when the area changes size or the sidebar closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, layout?.sidebarOpen])

  const save = useCallback((next: Layout | null) => {
    try {
      if (next) window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
    } catch {
      // storage unavailable: the layout still applies for this visit
    }
  }, [])

  /** Changes the layout and remembers it. */
  const update = useCallback(
    (change: (layout: Layout) => Layout) =>
      setLayout((current) => {
        if (!current) return current
        const next = change(current)
        save(next)
        return next
      }),
    [save]
  )

  // Dragging the sidebar's left edge resizes it (and the videos in it).
  const sidebarDrag = useRef<{ startX: number; startWidth: number } | null>(null)
  const roomRef = useRef<HTMLDivElement>(null)
  const maxSidebar = () => Math.min(SIDEBAR.max, (roomRef.current?.clientWidth ?? 1200) * SIDEBAR.share)
  function onSidebarPointerDown(event: React.PointerEvent) {
    if (!layout) return
    event.preventDefault()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    sidebarDrag.current = { startX: event.clientX, startWidth: layout.sidebarWidth }
  }
  function onSidebarPointerMove(event: React.PointerEvent) {
    const d = sidebarDrag.current
    if (!d) return
    const width = Math.min(Math.max(d.startWidth - (event.clientX - d.startX), SIDEBAR.min), maxSidebar())
    setLayout((current) => (current ? { ...current, sidebarWidth: width } : current))
  }
  function onSidebarPointerUp(event: React.PointerEvent) {
    if (!sidebarDrag.current) return
    sidebarDrag.current = null
    ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    setLayout((current) => {
      save(current)
      return current
    })
  }

  const tile = (track: TrackReferenceOrPlaceholder | undefined, className = 'h-full w-full') =>
    track ? (
      <div className={`relative overflow-hidden bg-slate-800 ${className}`}>
        <ParticipantTile trackRef={track} className="h-full w-full" />
        <ConnectionQualityIndicator participant={track.participant} className="absolute right-2 top-2" />
      </div>
    ) : null

  const pinButton = (who: Who, size: 'sm' | 'md' = 'sm') => {
    const pinned = layout?.pinned[who] ?? false
    const Icon = pinned ? Pin : PinOff
    return (
      <button
        type="button"
        onClick={() => update((l) => ({ ...l, pinned: { ...l.pinned, [who]: !l.pinned[who] } }))}
        title={pinned ? 'Pinned: stays visible when the sidebar is closed. Click to unpin.' : 'Pin: keep this video visible when the sidebar is closed'}
        aria-label={pinned ? `Unpin ${labelOf(who)}` : `Pin ${labelOf(who)}`}
        aria-pressed={pinned}
        className={`flex items-center justify-center rounded-full ${size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'} ${
          pinned ? 'bg-brand-500 text-white' : 'text-slate-300 hover:bg-white/15'
        }`}
      >
        <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      </button>
    )
  }

  // What fills the main area: a shared screen first, then video mode, else the Mushaf (with its toolbar). Only this area scrolls.
  const centre =
    share && showShare ? (
      <div className="relative h-full bg-slate-900">
        <VideoTrack trackRef={share} className="h-full w-full object-contain" />
        <button type="button" onClick={() => setShowShare(false)} className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Back to Mushaf
        </button>
      </div>
    ) : mode === 'video' ? (
      <div className="grid h-full gap-3 overflow-auto bg-slate-900 p-3 sm:grid-cols-2">
        {tile(tracks.remote, 'h-full min-h-48 rounded-2xl')}
        {tile(tracks.local, 'h-full min-h-48 rounded-2xl')}
      </div>
    ) : (
      <div className="h-full overflow-auto overscroll-contain bg-white p-3">{mushaf}</div>
    )

  const sidebarOpen = mode === 'mushaf' && !!layout?.sidebarOpen
  const floating = mode === 'mushaf' && layout && !layout.sidebarOpen && layout.windows && stage

  return (
    <div ref={roomRef} className="flex h-full flex-col overflow-hidden bg-slate-950">
      {connection === ConnectionState.Reconnecting || connection === ConnectionState.SignalReconnecting ? (
        <div role="status" className="flex flex-shrink-0 items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900">
          <WifiOff className="h-4 w-4" aria-hidden="true" /> Connection lost, reconnecting…
        </div>
      ) : null}
      {!remotes.length && connection === ConnectionState.Connected ? (
        <div className="flex-shrink-0 bg-slate-800 px-4 py-1.5 text-center text-xs text-slate-200">Waiting for {otherPartyName} to join…</div>
      ) : null}
      {share && !showShare ? (
        <button type="button" onClick={() => setShowShare(true)} className="flex-shrink-0 bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white">
          {share.participant.isLocal ? 'You are sharing your screen' : `${otherPartyName} is sharing their screen`} · Show it
        </button>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* The main area: the Mushaf and, with the sidebar closed, the pinned videos floating over it. */}
        <div ref={stageRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {centre}
          {floating
            ? order
                .filter((who) => layout.pinned[who] && tracks[who])
                .map((who) => (
                  <FloatingWindow
                    key={who}
                    box={layout.windows![who]}
                    stage={stage}
                    label={labelOf(who)}
                    actions={pinButton(who)}
                    onChange={(box) => setLayout((l) => (l && l.windows ? { ...l, windows: { ...l.windows, [who]: box } } : l))}
                    onCommit={() =>
                      setLayout((current) => {
                        save(current)
                        return current
                      })
                    }
                  >
                    {tile(tracks[who])}
                  </FloatingWindow>
                ))
            : null}
        </div>

        {/* Sidebar closed: a thin bar along the right edge, with the button to open it in its top corner. */}
        {mode === 'mushaf' && layout && !layout.sidebarOpen ? (
          <aside className="flex w-11 flex-shrink-0 flex-col items-center border-l border-white/10 bg-slate-900 py-2" aria-label="Videos (closed)">
            <button
              type="button"
              onClick={() => update((l) => ({ ...l, sidebarOpen: true }))}
              title="Open the video sidebar"
              aria-label="Open the video sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-200 hover:bg-white/10"
            >
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="mt-3 select-none text-[10px] font-semibold uppercase tracking-widest text-slate-500 [writing-mode:vertical-rl]">Videos</span>
          </aside>
        ) : null}

        {/* The video sidebar: videos stacked, sized by the sidebar's width (drag its left edge). */}
        {sidebarOpen && layout ? (
          <aside className="relative flex flex-shrink-0 flex-col border-l border-white/10 bg-slate-900" style={{ width: Math.min(layout.sidebarWidth, maxSidebar()) }} aria-label="Videos">
            <div
              onPointerDown={onSidebarPointerDown}
              onPointerMove={onSidebarPointerMove}
              onPointerUp={onSidebarPointerUp}
              onPointerCancel={onSidebarPointerUp}
              title="Drag to resize the videos"
              className="absolute inset-y-0 -left-1.5 z-10 w-3 cursor-ew-resize touch-none hover:bg-brand-500/40"
            />
            <div className="flex flex-shrink-0 items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>Videos</span>
              <button
                type="button"
                onClick={() => update((l) => ({ ...l, sidebarOpen: false }))}
                title="Close the sidebar (pinned videos float over the Mushaf)"
                aria-label="Close the video sidebar"
                className="rounded-full p-1 hover:bg-white/10"
              >
                <PanelRightClose className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
              {order
                .filter((who) => tracks[who])
                .map((who) => (
                  <div key={who} className="overflow-hidden rounded-2xl bg-slate-800 ring-1 ring-white/10">
                    <div className="flex h-7 items-center justify-between bg-slate-950/60 px-2 text-[11px] font-medium text-slate-200">
                      <span className="truncate">{labelOf(who)}</span>
                      {pinButton(who)}
                    </div>
                    <div style={{ aspectRatio: '16 / 9' }}>{tile(tracks[who])}</div>
                  </div>
                ))}
              <p className="text-[11px] leading-snug text-slate-500">
                Drag the sidebar&apos;s edge to resize the videos. Close it to move them freely: pinned videos (
                <Pin className="inline h-3 w-3" aria-hidden="true" />) stay on screen.
              </p>
            </div>
          </aside>
        ) : null}
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-slate-900 px-3 py-2.5">
        <TrackToggle source={Track.Source.Microphone} className={roundButton} showIcon aria-label="Microphone" />
        <TrackToggle source={Track.Source.Camera} className={roundButton} showIcon aria-label="Camera" />
        <TrackToggle source={Track.Source.ScreenShare} className={roundButton} showIcon aria-label="Share screen" />
        <button
          type="button"
          onClick={() => setMode(mode === 'video' ? 'mushaf' : 'video')}
          className={roundButton}
          title={mode === 'video' ? 'Back to the Mushaf' : 'Videos side by side'}
          aria-label={mode === 'video' ? 'Back to the Mushaf' : 'Videos side by side'}
        >
          {mode === 'video' ? <BookOpen className="h-4 w-4" aria-hidden="true" /> : <LayoutGrid className="h-4 w-4" aria-hidden="true" />}
        </button>
        <button type="button" onClick={onLeave} className="ml-2 flex h-10 items-center gap-1.5 rounded-full bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Leave
        </button>
      </div>
    </div>
  )
}
