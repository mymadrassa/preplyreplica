'use client'

import { useState } from 'react'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { TextArea } from '@/components/TextArea'
import { useToast } from '@/components/ToastProvider'
import { InfoTooltip } from '@/components/InfoTooltip'
import { SUBJECTS, LANGUAGES } from '@/lib/constants'
import { normalizeVideoUrl } from '@/lib/videoUrl'

const VIDEO_HELP_TEXT = 'Supported: YouTube, Vimeo, or Google Drive links, or a video file uploaded during onboarding. Please keep it to 90 seconds or less.'

export interface TeacherDetails {
  headline: string | null
  bio: string | null
  languages: string[]
  subjects: string[]
  hourly_rate: number | null
  video_url: string | null
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function ChoiceGroup({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div>
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((item) => (
          <label
            key={item}
            className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
              value.includes(item) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            <input type="checkbox" className="sr-only" checked={value.includes(item)} onChange={() => onChange(toggleValue(value, item))} />
            {item}
          </label>
        ))}
      </div>
      {value.length === 0 ? <p className="mt-2 text-xs text-red-600">Select at least one.</p> : null}
    </div>
  )
}

/** The teacher's public details (bio, subjects, languages, rate, intro video). The server decides whether a save goes live or into the copy awaiting review. */
export function TeacherDetailsForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: TeacherDetails
  /** Called after a successful save; `pendingReview` is true when the change waits for admin review. */
  onSaved?: (pendingReview: boolean) => void
  onCancel?: () => void
}) {
  const { showToast } = useToast()
  const [headline, setHeadline] = useState(initial.headline ?? '')
  const [bio, setBio] = useState(initial.bio ?? '')
  const [languages, setLanguages] = useState<string[]>(initial.languages.length ? initial.languages : ['English'])
  const [subjects, setSubjects] = useState<string[]>(initial.subjects)
  const [hourlyRate, setHourlyRate] = useState(initial.hourly_rate?.toString() ?? '25')
  const [videoUrl, setVideoUrl] = useState(initial.video_url ?? '')
  const [saving, setSaving] = useState(false)

  const trimmedVideoUrl = videoUrl.trim()
  const isOwnUpload = trimmedVideoUrl.includes('/storage/v1/object/public/teacher-videos/')
  const normalizedVideo = !isOwnUpload && trimmedVideoUrl ? normalizeVideoUrl(trimmedVideoUrl) : null
  const videoUrlInvalid = trimmedVideoUrl !== '' && !isOwnUpload && normalizedVideo === null

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!languages.length || !subjects.length) return showToast('error', 'Select at least one language and one subject.')
    if (videoUrlInvalid) return showToast('error', 'That video link is not supported. Paste a YouTube, Vimeo, or Google Drive link.')

    setSaving(true)
    try {
      const response = await fetch('/api/teacher/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline,
          bio,
          languages,
          subjects,
          hourly_rate: Number(hourlyRate),
          video_url: isOwnUpload ? trimmedVideoUrl : normalizedVideo?.embedUrl ?? '',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        showToast('error', data.error || 'Unable to save your details.')
        return
      }
      showToast('success', data.pendingReview ? 'Saved. Submit your changes for review when you’re ready.' : 'Details saved.')
      onSaved?.(!!data.pendingReview)
    } catch (err: any) {
      showToast('error', err.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Input label="Headline" name="headline" value={headline} onChange={(event) => setHeadline(event.target.value)} required />
      <TextArea label="Bio" name="bio" rows={5} value={bio} onChange={(event) => setBio(event.target.value)} required />
      <ChoiceGroup label="Languages" options={LANGUAGES} value={languages} onChange={setLanguages} />
      <ChoiceGroup label="Subjects" options={SUBJECTS} value={subjects} onChange={setSubjects} />
      <Input label="Hourly rate (£)" name="hourlyRate" type="number" min={8} value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} required />
      <div>
        <Input
          label={
            <>
              Intro video URL (optional)
              <InfoTooltip text={VIDEO_HELP_TEXT} />
            </>
          }
          name="videoUrl"
          type="url"
          value={videoUrl}
          onChange={(event) => setVideoUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=... or a Google Drive / Vimeo share link"
        />
        {videoUrlInvalid ? <p className="mt-1 text-xs text-red-600">We only support YouTube, Vimeo, or Google Drive links right now.</p> : null}
        {normalizedVideo ? (
          <iframe
            className="mt-3 h-48 w-full rounded-2xl border border-slate-200"
            src={normalizedVideo.embedUrl}
            title="Video preview"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : isOwnUpload ? (
          <video controls className="mt-3 h-48 w-full rounded-2xl border border-slate-200 bg-slate-950" src={trimmedVideoUrl} />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={saving}>
          Save details
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
