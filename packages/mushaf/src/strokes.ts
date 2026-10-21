import type { MushafClient } from './session'
import type { MushafStroke, MushafTables } from './types'

type StrokeRow = MushafTables['mushaf_strokes']['Row']

export type NewStroke = Pick<MushafStroke, 'page' | 'color' | 'width' | 'points'> & {
  /** Overrides the lesson tag (e.g. when re-saving the pieces of an erased stroke); undefined uses the viewer's current lesson. */
  bookingId?: string | null
}

export function strokeFromRow(row: StrokeRow): MushafStroke {
  return {
    id: row.id,
    sessionId: row.session_id,
    authorId: row.author_id,
    bookingId: row.booking_id,
    page: row.page,
    color: row.color,
    width: Number(row.width),
    points: row.points,
    createdAt: row.created_at,
  }
}

export async function listStrokes(supabase: MushafClient, sessionId: string): Promise<MushafStroke[]> {
  const { data } = await supabase
    .from('mushaf_strokes')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  return ((data ?? []) as StrokeRow[]).map(strokeFromRow)
}

export async function addStroke(
  supabase: MushafClient,
  sessionId: string,
  authorId: string,
  stroke: NewStroke,
  bookingId: string | null = null,
  /** Client-chosen id, so a locally shown copy of the stroke and the saved row are the same stroke. */
  id?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mushaf_strokes').insert({
    ...(id ? { id } : {}),
    session_id: sessionId,
    author_id: authorId,
    booking_id: bookingId,
    page: stroke.page,
    color: stroke.color,
    width: stroke.width,
    points: stroke.points,
  })
  return { error: error?.message ?? null }
}

export async function deleteStroke(supabase: MushafClient, strokeId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mushaf_strokes').delete().eq('id', strokeId)
  return { error: error?.message ?? null }
}

/** Keeps a freehand path to a sane size: drops points closer than `minDistance` (normalised units) to the previous kept one. */
export function simplifyPoints(points: [number, number][], minDistance = 0.002): [number, number][] {
  if (points.length <= 2) return points
  const kept: [number, number][] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = kept[kept.length - 1]
    if (Math.hypot(points[i][0] - px, points[i][1] - py) >= minDistance) kept.push(points[i])
  }
  kept.push(points[points.length - 1])
  return kept
}

type Point = [number, number]

// Adds points along each segment so none are further apart than `step`, which
// lets a fast eraser sweep or a long straight stroke be tested accurately.
function densify(points: Point[], step: number): Point[] {
  const out: Point[] = []
  for (let i = 0; i < points.length; i++) {
    out.push(points[i])
    if (i === points.length - 1) break
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    const pieces = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step)
    for (let k = 1; k < pieces; k++) out.push([x1 + ((x2 - x1) * k) / pieces, y1 + ((y2 - y1) * k) / pieces])
  }
  return out
}

/**
 * Cuts away the parts of a stroke that the eraser passed over. Points are
 * normalised (0..1); `size` is the drawing surface in pixels so the eraser
 * radius is round on screen whatever the page's aspect ratio.
 *
 * Returns null if the eraser never touched the stroke, otherwise the pieces
 * that remain (possibly none, possibly several when the cut splits it).
 */
export function eraseFromStroke(
  points: Point[],
  eraserPath: Point[],
  size: { width: number; height: number },
  radiusPx: number
): Point[][] | null {
  if (!eraserPath.length) return null
  const toPx = ([x, y]: Point): Point => [x * size.width, y * size.height]
  const step = Math.max(radiusPx / 2, 1)

  const stroke = densify(points.map(toPx), step)
  const eraser = densify(eraserPath.map(toPx), step)

  const erased = stroke.map(([x, y]) => eraser.some(([ex, ey]) => Math.hypot(x - ex, y - ey) < radiusPx))
  if (!erased.some(Boolean)) return null

  const pieces: Point[][] = []
  let run: Point[] = []
  stroke.forEach((p, i) => {
    if (erased[i]) {
      if (run.length >= 2) pieces.push(run)
      run = []
    } else {
      run.push(p)
    }
  })
  if (run.length >= 2) pieces.push(run)

  return pieces.map((piece) => simplifyPoints(piece.map(([x, y]): Point => [x / size.width, y / size.height])))
}
