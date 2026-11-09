import type { AnnotationKind } from './types'

/**
 * Who is looking at the Mushaf:
 * - teacher: leads a shared session with a student; only the teacher's marks are saved there
 * - student: follows the teacher in a shared session, read-only (their own marks go in their personal space)
 * - owner:   alone in their own personal space (a student or teacher revising); a student also sees
 *            their teachers' marks there, read-only
 */
export type MushafRole = 'teacher' | 'student' | 'owner'

/** What a role may see and do. UI reads these flags; it never branches on the role itself. */
export interface MushafCapabilities {
  /** Turning pages or jumping to a surah moves the shared page for everyone. Otherwise it only changes your own view. */
  controlsSharedPage: boolean
  /** The kinds of mark this role can add to a word (none: read-only). */
  markKinds: readonly AnnotationKind[]
  /** May draw on the page with the pen. */
  canDraw: boolean
  /** There is another author whose marks can be shown or hidden. */
  canFilterByAuthor: boolean
}

// The single place roles differ. Changing who can do what is a change to this table.
const CAPABILITIES: Record<MushafRole, MushafCapabilities> = {
  teacher: { controlsSharedPage: true, markKinds: ['highlight', 'error', 'note'], canDraw: true, canFilterByAuthor: true },
  student: { controlsSharedPage: false, markKinds: [], canDraw: false, canFilterByAuthor: true },
  owner: { controlsSharedPage: true, markKinds: ['highlight', 'error', 'note'], canDraw: true, canFilterByAuthor: false },
}

export function capabilitiesFor(role: MushafRole): MushafCapabilities {
  return CAPABILITIES[role]
}

/**
 * How a mark's author is named to the viewer. In a personal space the marks
 * are the owner's own, or (for a student) a teacher's shown alongside.
 */
export function authorLabel(role: MushafRole, authorId: string, teacherId: string | null, currentUserId?: string): string {
  if (role === 'owner') return currentUserId === undefined || authorId === currentUserId ? 'You' : 'Teacher'
  return authorId === teacherId ? 'Teacher' : 'Student'
}
