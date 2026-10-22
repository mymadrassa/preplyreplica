'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Eye, FileText, ImageUp, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/ToastProvider'
import { createBrowserClient } from '@/lib/supabase/client'
import type { DocumentRow } from '@/lib/teacherProfileState'

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, '_').slice(-80)
}

function fileNameOf(path: string) {
  return path.split('/').pop()?.replace(/^\d+-/, '') ?? path
}

/**
 * Picks, previews and saves a profile photo. The file goes to the teacher's own
 * avatars folder; the server then decides whether it replaces the live photo
 * (removing the old file) or waits in the copy for review.
 */
export function PhotoUploader({ userId, current, onDone, reviewed = false }: { userId: string; current: string | null; onDone?: () => void; reviewed?: boolean }) {
  const router = useRouter()
  const { showToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function choose(next: File | undefined) {
    if (!next) return
    if (!PHOTO_TYPES.includes(next.type)) return showToast('error', 'Please choose a JPEG, PNG or WebP image.')
    if (next.size > MAX_PHOTO_BYTES) return showToast('error', 'That image is over 5 MB. Please choose a smaller one.')
    setFile(next)
  }

  async function save() {
    if (!file) return
    setSaving(true)
    const supabase = createBrowserClient()
    const path = `${userId}/${Date.now()}-${safeFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type })
    if (uploadError) {
      setSaving(false)
      return showToast('error', uploadError.message)
    }
    const response = await fetch('/api/teacher/photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) })
    const result = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) return showToast('error', result.error || 'Unable to save your photo.')
    setFile(null)
    showToast('success', result.pendingReview ? 'New photo saved. Submit your changes for review when you’re ready.' : 'Profile photo saved.')
    onDone?.()
    router.refresh()
  }

  const shown = preview ?? current
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-card">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview / storage URL
          <img src={shown} alt="Your profile photo" className="h-full w-full object-cover" />
        ) : (
          <ImageUp className="h-10 w-10 text-slate-300" aria-hidden="true" />
        )}
      </div>
      <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {current || file ? 'Choose a different photo' : 'Choose a photo'}
        <input type="file" accept={PHOTO_TYPES.join(',')} className="sr-only" onChange={(event) => choose(event.target.files?.[0])} />
      </label>
      <p className="text-xs text-slate-500">JPEG, PNG or WebP, up to 5 MB.{reviewed ? ' Your current photo stays live until the new one is approved.' : ''}</p>
      <div className="flex gap-2">
        {file ? (
          <Button type="button" onClick={save} loading={saving}>
            Save photo
          </Button>
        ) : current && !onDone ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Photo saved
          </p>
        ) : null}
        {onDone ? (
          <Button type="button" variant="secondary" onClick={onDone} disabled={saving}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Lists, uploads and removes the teacher's ID documents or certificates.
 * Removing deletes both the record and the stored file; to replace a document,
 * remove it and upload the new one. Read-only while the profile is under review.
 */
export function DocumentsStep({
  userId,
  kind,
  documents,
  locked,
  reviewed = false,
}: {
  userId: string
  kind: 'identity' | 'certificate'
  documents: DocumentRow[]
  locked: boolean
  /** Live profile + ID: changes wait for admin review while the current ID stays valid. */
  reviewed?: boolean
}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [replacing, setReplacing] = useState<string | null>(null)

  /** Uploads new documents; with `replaces`, the single new file takes that document's place. */
  /** Asks before the first ID change on a live profile, as with other reviewed edits. */
  function confirmReviewed() {
    const alreadyPending = documents.some((d) => d.review_change)
    return (
      !reviewed ||
      alreadyPending ||
      window.confirm('Your profile is approved, so changing your ID needs a new review. Your current ID stays valid until the change is approved. Continue?')
    )
  }

  async function upload(files: FileList | null, replaces?: string) {
    if (!files?.length) return
    if (!confirmReviewed()) return
    const tooBig = Array.from(files).find((f) => f.size > MAX_DOCUMENT_BYTES)
    if (tooBig) return showToast('error', `${tooBig.name} is over 10 MB.`)

    if (replaces) setReplacing(replaces)
    else setUploading(true)
    const done = () => {
      setUploading(false)
      setReplacing(null)
    }
    const supabase = createBrowserClient()
    for (const file of Array.from(files)) {
      const path = `${userId}/${kind}/${Date.now()}-${safeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage.from('teacher-documents').upload(path, file, { contentType: file.type })
      if (uploadError) {
        done()
        return showToast('error', uploadError.message)
      }
      const response = await fetch('/api/teacher/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket_path: path, kind, replaces }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        done()
        return showToast('error', result.error || 'Unable to save that document.')
      }
    }
    done()
    showToast(
      'success',
      reviewed
        ? 'Saved. Submit your changes for review when you’re ready.'
        : replaces
          ? 'Document replaced.'
          : files.length === 1
            ? 'Document uploaded.'
            : `${files.length} documents uploaded.`
    )
    router.refresh()
  }

  async function remove(doc: DocumentRow) {
    if (!confirmReviewed()) return
    if (!reviewed && !window.confirm(`Remove ${fileNameOf(doc.bucket_path)}? The file will be deleted.`)) return
    setRemoving(doc.id)
    const response = await fetch(`/api/teacher/documents?id=${encodeURIComponent(doc.id)}`, { method: 'DELETE' })
    const result = await response.json().catch(() => ({}))
    setRemoving(null)
    if (!response.ok) return showToast('error', result.error || 'Unable to remove that document.')
    showToast('success', 'Document removed.')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {documents.length ? (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
              <span className={`min-w-0 flex-1 truncate ${doc.review_change === 'remove' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{fileNameOf(doc.bucket_path)}</span>
              {doc.review_change === 'add' ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">New · pending review</span>
              ) : doc.review_change === 'remove' ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Removed after review</span>
              ) : null}
              <span className="text-xs text-slate-400">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
              <a
                href={`/api/teacher/documents/${doc.id}/view`}
                target="_blank"
                rel="noreferrer"
                title="Preview in a new tab"
                aria-label={`Preview ${fileNameOf(doc.bucket_path)} in a new tab`}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
              </a>
              {locked || doc.review_change === 'remove' ? (
                doc.review_change ? null : <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Uploaded" />
              ) : (
                <>
                <label
                  title="Replace with a new file"
                  aria-label={`Replace ${fileNameOf(doc.bucket_path)}`}
                  className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 ${replacing === doc.id ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <RefreshCw className={`h-4 w-4 ${replacing === doc.id ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="sr-only"
                    disabled={replacing !== null}
                    onChange={(event) => {
                      upload(event.target.files, doc.id)
                      event.target.value = ''
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => remove(doc)}
                  disabled={removing === doc.id}
                  title="Remove"
                  aria-label={`Remove ${fileNameOf(doc.bucket_path)}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {kind === 'identity' ? 'No ID uploaded yet.' : 'No certificates uploaded yet.'}
        </p>
      )}

      {!locked ? (
        <label
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-6 text-sm font-medium text-brand-700 hover:bg-brand-50 ${
            uploading ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {uploading ? 'Uploading…' : documents.length ? 'Add another file' : 'Upload a file'}
          <input type="file" accept="application/pdf,image/*" multiple className="sr-only" disabled={uploading} onChange={(event) => upload(event.target.files)} />
        </label>
      ) : null}
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> PDF or image, up to 10 MB each. Stored privately; only our review team can see it.
        {reviewed ? ' Your profile is live: ID changes need a quick review, and your current ID stays valid until then.' : ''}
      </p>
    </div>
  )
}
