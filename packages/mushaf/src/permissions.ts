import type { AnnotationKind } from './types'

/**
 * Who is looking at the Mushaf:
 * - teacher: leads a shared session with a student
 * - student: follows the teacher in a shared session
 * - owner:   alone in their own personal space (a student or teacher revising)
 */
export type MushafRole = 'teacher' | 'student' | 'owner'

/** What a role may see and do. UI reads these flags; it never branches on the role itself. */
export interface MushafCapabilities {
  /** Turning pages or jumping to a surah moves the shared page for everyone. Otherwise it only changes your own view. */
  controlsSharedPage: boolean
  /** The kinds of mark this role can add to a word. */
  markKinds: readonly AnnotationKind[]
  /** There is another author whose marks can be shown or hidden. */
  canFilterByAuthor: boolean
}

// The single place roles differ. Changing who can do what is a change to this table.
const CAPABILITIES: Record<MushafRole, MushafCapabilities> = {
  teacher: { controlsSharedPage: true, markKinds: ['highlight', 'error', 'note'], canFilterByAuthor: true },
  student: { controlsSharedPage: false, markKinds: ['note'], canFilterByAuthor: true },
  owner: { controlsSharedPage: true, markKinds: ['highlight', 'error', 'note'], canFilterByAuthor: false },
}

export function capabilitiesFor(role: MushafRole): MushafCapabilities {
  return CAPABILITIES[role]
}

/** How a mark's author is named to the viewer. */
export function authorLabel(role: MushafRole, authorId: string, teacherId: string | null): string {
  if (role === 'owner') return 'You'
  return authorId === teacherId ? 'Teacher' : 'Student'
}
