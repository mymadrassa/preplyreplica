// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/TeacherOnboardingForm.tsx
'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { TextArea } from '@/components/TextArea'
import { useToast } from '@/components/ToastProvider'
import { SUBJECTS, LANGUAGES } from '@/lib/constants'
import { normalizeVideoUrl } from '@/lib/videoUrl'
import { InfoTooltip } from '@/components/InfoTooltip'

const VIDEO_HELP_TEXT = 'Supported: YouTube, Vimeo, or Google Drive links, or a video file uploaded during onboarding. Please keep it to 90 seconds or less.'

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export function TeacherOnboardingForm({ existingProfile }: any) {
  const supabase = createBrowserClient()
  const { showToast } = useToast()
  const [headline, setHeadline] = useState(existingProfile?.headline || '')
  const [bio, setBio] = useState(existingProfile?.bio || '')
  const [languages, setLanguages] = useState<string[]>(existingProfile?.languages || ['English'])
  const [subjects, setSubjects] = useState<string[]>(existingProfile?.subjects || [])
  const [hourlyRate, setHourlyRate] = useState(existingProfile?.hourly_rate?.toString() || '25')
  const [videoUrl, setVideoUrl] = useState(existingProfile?.video_url || '')
  const [documents, setDocuments] = useState<FileList | null>(null)
  const [loadingAction, setLoadingAction] = useState<'save' | 'stripe' | null>(null)
  const stripeAlreadySetUp = existingProfile?.stripe_charges_enabled === true

  const trimmedVideoUrl = videoUrl.trim()
  const isOwnUpload = trimmedVideoUrl.includes('/storage/v1/object/public/teacher-videos/')
  const normalizedVideo = !isOwnUpload && trimmedVideoUrl ? normalizeVideoUrl(trimmedVideoUrl) : null
  const videoUrlInvalid = trimmedVideoUrl !== '' && !isOwnUpload && normalizedVideo === null

  async function uploadDocuments(files: FileList) {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_TEACHER_DOCS || 'teacher-documents'
    const folder = `teacher-documents/${Date.now()}`
    const paths: string[] = []

    for (const file of Array.from(files)) {
      const path = `${folder}/${file.name}`
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
      if (error) {
        throw new Error(error.message)
      }
      paths.push(path)
    }

    return paths
  }

  async function submit(startStripeOnboarding: boolean) {
    if (languages.length === 0 || subjects.length === 0) {
      showToast('error', 'Select at least one language and one subject.')
      return
    }
    if (videoUrlInvalid) {
      showToast('error', 'That video link is not supported. Paste a YouTube, Vimeo, or Google Drive link.')
      return
    }

    setLoadingAction(startStripeOnboarding ? 'stripe' : 'save')

    try {
      const documentPaths = documents ? await uploadDocuments(documents) : []
      const resolvedVideoUrl = isOwnUpload ? trimmedVideoUrl : normalizedVideo?.embedUrl ?? ''
      const response = await fetch('/api/teacher/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline,
          bio,
          languages,
          subjects,
          hourly_rate: Number(hourlyRate),
          video_url: resolvedVideoUrl,
          document_paths: documentPaths,
          start_stripe_onboarding: startStripeOnboarding,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        showToast('error', data.error || 'Unable to submit onboarding.')
        setLoadingAction(null)
        return
      }

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl
        return
      }

      showToast('success', 'Profile updated.')
      setLoadingAction(null)
    } catch (err: any) {
      showToast('error', err.message || 'Upload failed.')
      setLoadingAction(null)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Headline" name="headline" value={headline} onChange={(event) => setHeadline(event.target.value)} required />
      <TextArea label="Bio" name="bio" rows={5} value={bio} onChange={(event) => setBio(event.target.value)} required />
      <div>
        <span className="block text-sm font-medium text-slate-700">Languages</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((item) => (
            <label
              key={item}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
                languages.includes(item)
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={languages.includes(item)}
                onChange={() => setLanguages((current) => toggleValue(current, item))}
              />
              {item}
            </label>
          ))}
        </div>
        {languages.length === 0 ? <p className="mt-2 text-xs text-red-600">Select at least one language.</p> : null}
      </div>
      <div>
        <span className="block text-sm font-medium text-slate-700">Subjects</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUBJECTS.map((item) => (
            <label
              key={item}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
                subjects.includes(item)
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={subjects.includes(item)}
                onChange={() => setSubjects((current) => toggleValue(current, item))}
              />
              {item}
            </label>
          ))}
        </div>
        {subjects.length === 0 ? <p className="mt-2 text-xs text-red-600">Select at least one subject.</p> : null}
      </div>
      <Input label="Hourly rate" name="hourlyRate" type="number" min={8} value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} required />
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
      <div>
        <label className="block text-sm font-medium text-slate-700">Verification documents (optional)</label>
        <p className="mt-1 text-xs text-slate-500">
          A government-issued ID and any teaching certificates or diplomas you have. Our team uses these to verify your
          identity and qualifications before approving your profile — they are never shown publicly. PDF or image files.
        </p>
        <input type="file" accept="application/pdf,image/*" multiple onChange={(event) => setDocuments(event.target.files)} className="mt-2 w-full text-sm text-slate-700" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={loadingAction === 'save'} disabled={loadingAction === 'stripe'}>
          Save changes
        </Button>
        {!stripeAlreadySetUp ? (
          <Button
            type="button"
            variant="secondary"
            loading={loadingAction === 'stripe'}
            disabled={loadingAction === 'save'}
            onClick={() => submit(true)}
          >
            Continue Stripe onboarding
          </Button>
        ) : null}
      </div>
    </form>
  )
}
