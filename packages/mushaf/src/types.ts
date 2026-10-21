export interface MushafWord {
  /** `surah:ayah:word`, e.g. "1:1:2" — the addressable id for a single word. */
  id: string
  surah: number
  ayah: number
  wordIndex: number
  text: string
  /** A verse-end number ornament. It is selectable and markable like a word. */
  isMarker?: boolean
  /** Glyph(s) in the page's QCF font; absent when only plain text is available. */
  glyph?: string
  /** Which page's QCF font the glyph belongs to. */
  fontPage?: number
}

export interface MushafLine {
  lineNumber: number
  /** 'text' (default) is a line of words; 'header' is a surah title banner; 'basmala' the opening invocation. */
  kind?: 'text' | 'header' | 'basmala'
  words: MushafWord[]
  /** Arabic surah name, for a 'header' line. */
  surahName?: string
}

export interface MushafPageData {
  page: number
  lines: MushafLine[]
  /** True when the QCF glyph fonts loaded, so words render as glyphs; otherwise plain text. */
  fontsReady?: boolean
}

export type AnnotationKind = 'highlight' | 'error' | 'note'

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

export type ErrorType = 'memorisation' | 'tajwid' | 'hesitation'

export interface MushafAnnotation {
  id: string
  sessionId: string
  authorId: string
  /** The lesson (booking) this mark was made during, if any. */
  bookingId: string | null
  kind: AnnotationKind
  color: HighlightColor | null
  errorType: ErrorType | null
  /** `surah:ayah:word` — set for a word-level highlight/error, null for a verse-level note. */
  wordRef: string | null
  /** For a note spanning several selected words: the last word of the range (`wordRef` is the first). */
  endWordRef: string | null
  /** `surah:ayah` — always set. */
  verseRef: string
  noteText: string | null
  createdAt: string
}

export interface MushafStroke {
  id: string
  sessionId: string
  authorId: string
  bookingId: string | null
  page: number
  color: string
  width: number
  /** [x, y] pairs, each normalised to 0..1 of the page's width/height. */
  points: [number, number][]
  createdAt: string
}

/** The narrow slice of a host app's database this package actually touches — kept
 * separate from any app's full generated `Database` type so the package stays
 * portable to a different app later. */
export interface MushafTables {
  mushaf_sessions: {
    Row: {
      id: string
      /** The owner, for a personal session (teacher_id null). */
      student_id: string
      teacher_id: string | null
      current_page: number
      updated_at: string
    }
    Insert: {
      student_id: string
      teacher_id?: string | null
      current_page?: number
    }
    Update: {
      current_page?: number
      updated_at?: string
    }
  }
  mushaf_annotations: {
    Row: {
      id: string
      session_id: string
      author_id: string
      booking_id: string | null
      kind: AnnotationKind
      color: HighlightColor | null
      error_type: ErrorType | null
      word_ref: string | null
      end_word_ref: string | null
      verse_ref: string
      note_text: string | null
      created_at: string
    }
    Insert: {
      session_id: string
      author_id: string
      booking_id?: string | null
      kind: AnnotationKind
      color?: HighlightColor | null
      error_type?: ErrorType | null
      word_ref?: string | null
      end_word_ref?: string | null
      verse_ref: string
      note_text?: string | null
    }
    Update: never
  }
  mushaf_strokes: {
    Row: {
      id: string
      session_id: string
      author_id: string
      booking_id: string | null
      page: number
      color: string
      width: number
      points: [number, number][]
      created_at: string
    }
    Insert: {
      id?: string
      session_id: string
      author_id: string
      booking_id?: string | null
      page: number
      color: string
      width?: number
      points: [number, number][]
    }
    Update: never
  }
}

export interface MushafDatabase {
  public: {
    Tables: MushafTables
  }
}
