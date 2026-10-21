'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { canDeleteAnnotation } from '../annotations'
import { authorLabel, capabilitiesFor, type MushafRole } from '../permissions'
import type { MushafClient } from '../session'
import { buildMarkBlocks, flattenWords, wordsBetween, type MarkBlock } from '../selection'
import type { MushafWord } from '../types'
import { useMushafPage } from '../useMushafPage'
import { useMushafSync } from '../useMushafSync'
import { AnnotationToolbar } from './AnnotationToolbar'
import { DrawingLayer, type StrokeErase } from './DrawingLayer'
import { DrawingToolbar, PEN_COLORS, type DrawingTool } from './DrawingToolbar'
import { HintTooltip } from './HintTooltip'
import { Icon } from './icons'
import { LoadingBlock } from './Spinner'
import { MushafPage } from './MushafPage'
import { PageNav } from './PageNav'
import { SurahSearch } from './SurahSearch'
import { ThemeToggle } from './ThemeToggle'
import { MarksSummary } from './MarksSummary'

interface MushafViewerProps {
  supabase: MushafClient
  role: MushafRole
  sessionId: string
  /** Null for a personal space, where there's no teacher to filter by. */
  teacherId: string | null
  currentUserId: string
  initialPage: number
  /** The lesson (booking) new marks are tagged with. */
  bookingId?: string | null
  /** Lessons whose marks can be reviewed separately; omit for a personal space. */
  lessons?: MushafLesson[]
  /** Surfaces failures (e.g. through the host app's toast system). */
  onError?: (message: string) => void
}

type MarkFilter = 'all' | 'teacher'

const SUMMARY_CLOSE_MS = 300

export interface MushafLesson {
  id: string
  label: string
}

// Date-picker style selection: the first click starts, the next click on another
// word ends a range, and clicking the start word again selects just that word.
// Only a finished selection (committed) opens the toolbar; a click after that
// starts over.
interface Selection {
  startId: string
  endId: string | null
  committed: boolean
}

export function MushafViewer({ supabase, role, sessionId, teacherId, currentUserId, initialPage, bookingId = null, lessons = [], onError }: MushafViewerProps) {
  const sync = useMushafSync({ supabase, sessionId, currentUserId, initialPage, bookingId })
  // A student can look elsewhere (e.g. via the surah search) without moving the teacher's page;
  // `detachedPage` is that private view, and null means following the shared page.
  const [detachedPage, setDetachedPage] = useState<number | null>(null)
  const viewPage = detachedPage ?? sync.currentPage
  const { page, loading: pageLoading } = useMushafPage(viewPage)
  const [lessonFilter, setLessonFilter] = useState<string>(bookingId ?? 'all')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const pageRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<MarkFilter>('all')
  const [tool, setTool] = useState<DrawingTool | null>(null)
  const [hiddenStrokeIds, setHiddenStrokeIds] = useState<Set<string>>(new Set())
  const [dark, setDark] = useState(false)
  const [penColor, setPenColor] = useState(PEN_COLORS[0])

  const reportError = onError ?? (() => {})
  const can = capabilitiesFor(role)
  const nameOf = (authorId: string) => authorLabel(role, authorId, teacherId)

  const selectedWords = useMemo(() => {
    if (!page || !selection) return []
    if (selection.endId) return wordsBetween(page, selection.startId, selection.endId)
    const single = flattenWords(page).find((w) => w.id === selection.startId)
    return single ? [single] : []
  }, [page, selection])
  const selectedIds = useMemo(() => new Set(selectedWords.map((w) => w.id)), [selectedWords])

  const pageVerseRefs = useMemo(() => new Set(page?.lines.flatMap((l) => l.words.map((w) => `${w.surah}:${w.ayah}`)) ?? []), [page])

  const visibleAnnotations = useMemo(
    () =>
      sync.annotations.filter(
        (a) => (filter === 'all' || a.authorId === teacherId) && (lessonFilter === 'all' || a.bookingId === lessonFilter)
      ),
    [sync.annotations, filter, teacherId, lessonFilter]
  )
  const visibleStrokes = useMemo(
    () =>
      sync.strokes.filter(
        (x) =>
          !hiddenStrokeIds.has(x.id) && (filter === 'all' || x.authorId === teacherId) && (lessonFilter === 'all' || x.bookingId === lessonFilter)
      ),
    [sync.strokes, filter, teacherId, lessonFilter, hiddenStrokeIds]
  )
  const myLastStroke = [...sync.strokes].reverse().find((x) => x.page === viewPage && x.authorId === currentUserId)
  const pageNotes = visibleAnnotations.filter((a) => a.kind === 'note' && pageVerseRefs.has(a.verseRef))

  const blocks = useMemo(() => (page ? buildMarkBlocks(page, visibleAnnotations) : []), [page, visibleAnnotations])
  const verseNotes = visibleAnnotations.filter((a) => a.kind === 'note' && !a.wordRef && pageVerseRefs.has(a.verseRef))
  const hasMarks = blocks.length > 0 || verseNotes.length > 0

  function clearSelection() {
    setSelection(null)
    setAnchor(null)
    setToolbarOpen(false)
  }

  function handleSelectWord(word: MushafWord, element: HTMLElement) {
    // A finished selection, or nothing yet: this click starts a new one.
    if (!selection || selection.committed) {
      setSelection({ startId: word.id, endId: null, committed: false })
      setToolbarOpen(false)
      setAnchor(null)
      return
    }

    // Second click: end the range (the same word again = just that word) and open the toolbar.
    setSelection({ startId: selection.startId, endId: word.id === selection.startId ? null : word.id, committed: true })
    const container = pageRef.current?.getBoundingClientRect()
    if (container) {
      const rect = element.getBoundingClientRect()
      // The toolbar is 18rem (288px) wide and centred on x: keep it inside the page.
      const x = Math.min(Math.max(rect.left - container.left + rect.width / 2, 150), Math.max(container.width - 150, 150))
      setAnchor({ x, y: rect.bottom - container.top + 8 })
    }
    setToolbarOpen(true)
  }

  function focusBlock(block: MarkBlock) {
    const first = block.words[0]
    const last = block.words[block.words.length - 1]
    setSelection({ startId: first.id, endId: first.id === last.id ? null : last.id, committed: true })
    setToolbarOpen(false)
    setAnchor(null)
  }

  async function handleDelete(annotationId: string) {
    const { error } = await sync.deleteAnnotation(annotationId)
    if (error) reportError(error)
  }

  const hasSelection = selectedWords.length > 0
  const selectionHasMarks = blocks.some((block) => block.words.some((w) => selectedIds.has(w.id)))

  // Clicking anywhere outside the words, the toolbar and the summary drops a
  // selection that has no marks on it (a marked one stays, tied to its card).
  useEffect(() => {
    if (!selection || selectionHasMarks) return
    function onPointerDown(event: PointerEvent) {
      if ((event.target as Element | null)?.closest('[data-word-id], [data-mushaf-keep]')) return
      clearSelection()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
    // clearSelection only sets state, so it is safe to omit from the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, selectionHasMarks])
  const pending = !!selection && !selection.committed
  const showPanel = hasMarks && panelOpen && !!page

  // Hiding the summary yourself slides the column shut so the page grows back smoothly;
  // everything else (deleting the last card, switching pages) changes the layout at once.
  const [summaryClosing, setSummaryClosing] = useState(false)
  function hideSummary() {
    setSummaryClosing(true)
    window.setTimeout(() => {
      setPanelOpen(false)
      setSummaryClosing(false)
    }, SUMMARY_CLOSE_MS)
  }

  async function handleDeleteMany(annotationIds: string[]) {
    const { error } = await sync.deleteAnnotations(annotationIds)
    if (error) reportError(error)
  }

  // A rubbed-out stroke is saved as its remaining pieces: the pieces are stored first,
  // then the original is deleted, so a failed save never loses the drawing.
  async function handleErase(erases: StrokeErase[]) {
    setHiddenStrokeIds((prev) => new Set([...prev, ...erases.map((e) => e.stroke.id)]))
    for (const { stroke, pieces } of erases) {
      const saved = await Promise.all(
        pieces.map((points) => sync.addStroke({ page: stroke.page, color: stroke.color, width: stroke.width, points, bookingId: stroke.bookingId }))
      )
      const failure = saved.find((result) => result.error)
      if (failure?.error) {
        reportError(failure.error)
        setHiddenStrokeIds((prev) => new Set([...prev].filter((id) => id !== stroke.id)))
        continue
      }
      const { error } = await sync.deleteStroke(stroke.id)
      if (error) reportError(error)
    }
  }

  return (
    <div className="space-y-4">
      <PageNav
        currentPage={viewPage}
        detached={detachedPage !== null}
        canNavigate={can.controlsSharedPage}
        onChange={(next) => {
          clearSelection()
          sync.setPage(next)
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {hasMarks && !panelOpen ? (
          <button
            type="button"
            title="Show summary"
            aria-label="Show summary"
            onClick={() => setPanelOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <Icon name="chevron-right" />
          </button>
        ) : null}
        <DrawingToolbar
          tool={tool}
          penColor={penColor}
          canUndo={!!myLastStroke}
          dark={dark}
          onToggleTool={(next) => {
            clearSelection()
            setTool((current) => (current === next ? null : next))
          }}
          onPenColor={setPenColor}
          onUndo={async () => {
            if (!myLastStroke) return
            const { error } = await sync.deleteStroke(myLastStroke.id)
            if (error) reportError(error)
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          {detachedPage !== null ? (
            <button
              type="button"
              title="Back to your teacher's page"
              aria-label="Back to your teacher's page"
              onClick={() => {
                clearSelection()
                setDetachedPage(null)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-500 bg-brand-50 text-brand-700"
            >
              <Icon name="link" />
            </button>
          ) : null}
          <SurahSearch
            onSelect={(startPage) => {
              clearSelection()
              // The teacher moves the shared page; anyone else only changes their own view.
              if (can.controlsSharedPage) sync.setPage(startPage)
              else setDetachedPage(startPage)
            }}
          />
          <ThemeToggle dark={dark} onChange={setDark} />
          <HintTooltip active={pending}>
            Click a word to start a selection, then click another word to end it. Click the same word again to select just that one. Click outside to cancel.
          </HintTooltip>
        </div>
      </div>

      <div
        className={showPanel ? 'gap-4 space-y-4 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:space-y-0' : ''}
        style={
          showPanel
            ? {
                transition: `grid-template-columns ${SUMMARY_CLOSE_MS}ms ease, column-gap ${SUMMARY_CLOSE_MS}ms ease`,
                ...(summaryClosing ? { gridTemplateColumns: '0rem minmax(0, 1fr)', columnGap: '0rem' } : {}),
              }
            : undefined
        }
      >
        {showPanel ? (
          <div
            className={summaryClosing ? 'min-w-0 overflow-hidden' : undefined}
            style={{ opacity: summaryClosing ? 0 : 1, transition: `opacity ${SUMMARY_CLOSE_MS - 50}ms ease` }}
          >
            <div style={summaryClosing ? { width: '17rem' } : undefined}>
              <MarksSummary
                pageNumber={viewPage}
                blocks={blocks}
                verseNotes={verseNotes}
                selectedWordIds={selectedIds}
                authorLabel={nameOf}
                currentUserId={currentUserId}
                onDelete={handleDeleteMany}
                onFocusBlock={focusBlock}
                onClose={hideSummary}
              />
            </div>
          </div>
        ) : null}

        {page ? (
          <div ref={pageRef} className="relative min-w-0">
            <MushafPage page={page} annotations={visibleAnnotations} selectedWordIds={selectedIds} selectionPending={pending} dark={dark} onSelectWord={handleSelectWord} />
            <DrawingLayer
              page={viewPage}
              strokes={visibleStrokes}
              tool={tool}
              currentUserId={currentUserId}
              color={penColor}
              dark={dark}
              width={3}
              onStroke={async (stroke) => {
                const { error } = await sync.addStroke(stroke)
                if (error) reportError(error)
              }}
              onErase={handleErase}
            />
            {toolbarOpen && selection?.committed && hasSelection && anchor ? (
              <div data-mushaf-keep className="absolute z-20 -translate-x-1/2" style={{ left: anchor.x, top: anchor.y }}>
                <AnnotationToolbar
                  key={selectedWords.map((w) => w.id).join(',')}
                  markKinds={can.markKinds}
                  words={selectedWords}
                  existing={visibleAnnotations}
                  currentUserId={currentUserId}
                  onAdd={sync.addAnnotations}
                  onRemove={sync.deleteAnnotations}
                  onError={reportError}
                  onClose={clearSelection}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="min-w-0">
            {pageLoading ? (
              <LoadingBlock label="Loading page…" dark={dark} tall />
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">This page could not be loaded.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {can.canFilterByAuthor ? (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Show marks:</span>
            {(['all', 'teacher'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  filter === value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'
                }`}
              >
                {value === 'all' ? 'All' : 'Teacher only'}
              </button>
            ))}
          </div>
        ) : null}
        {lessons.length ? (
          <label className="flex items-center gap-2">
            <span className="text-slate-500">Lesson:</span>
            <select
              value={lessonFilter}
              onChange={(event) => setLessonFilter(event.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
            >
              <option value="all">All lessons</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {pageNotes.length ? (
        <ul className="space-y-2">
          {pageNotes.map((note) => (
            <li key={note.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="flex min-w-0 items-start gap-2">
                <Icon name="comment" className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">
                    Verse {note.verseRef} · {nameOf(note.authorId)} · {new Date(note.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 break-words text-slate-800">{note.noteText}</p>
                </div>
              </div>
              {canDeleteAnnotation(note, currentUserId) ? (
                <button
                  type="button"
                  title="Remove"
                  aria-label="Remove"
                  onClick={() => handleDelete(note.id)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                >
                  <Icon name="trash" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
