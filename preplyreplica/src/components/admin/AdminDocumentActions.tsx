'use client'

import { Download, Eye } from 'lucide-react'

/**
 * View and download buttons for one teacher document. A file that failed its
 * safety check can't be opened in the browser; downloading it asks first and
 * saves it under a harmless `.bin` name.
 */
export function AdminDocumentActions({ documentId, suspicious }: { documentId: string; suspicious: boolean }) {
  const iconButton = 'flex h-9 w-9 items-center justify-center rounded-full border transition-colors'
  return (
    <div className="flex items-center gap-2">
      {suspicious ? (
        <span title="Blocked: this file failed its safety check" className={`${iconButton} cursor-not-allowed border-slate-200 text-slate-300`} aria-disabled="true">
          <Eye className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">View blocked</span>
        </span>
      ) : (
        <a
          href={`/api/teacher/documents/${documentId}/view`}
          target="_blank"
          rel="noreferrer"
          title="View"
          aria-label="View document"
          className={`${iconButton} border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </a>
      )}
      <a
        href={`/api/teacher/documents/${documentId}/download`}
        title={suspicious ? 'Download (suspicious file)' : 'Download'}
        aria-label="Download document"
        onClick={(event) => {
          if (suspicious && !window.confirm('This file failed its safety check: it is not a real PDF or image and could be harmful. It will be saved as a .bin file. Download anyway?')) {
            event.preventDefault()
          }
        }}
        className={`${iconButton} ${suspicious ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  )
}
