'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { Input } from '@/components/Input'
import { useToast } from '@/components/ToastProvider'
import { createBrowserClient } from '@/lib/supabase/client'
import { useTeacherWizard } from '@/components/onboarding/TeacherWizardProvider'
import { useTeacherStepGuard } from '@/components/onboarding/useTeacherStepGuard'
import { normalizeVideoUrl } from '@/lib/videoUrl'
import { InfoTooltip } from '@/components/InfoTooltip'
import { TEACHER_WIZARD_STEPS } from './steps'

const VIDEO_HELP_TEXT = 'Supported: YouTube, Vimeo, or Google Drive links, or upload a video file directly (MP4, WebM, or MOV). Keep it to 90 seconds or less.'
const MAX_VIDEO_SECONDS = 90

type VideoMode = 'url' | 'upload'

export function StepMedia() {
  const [submitted, setSubmitted] = useState(false)
  useTeacherStepGuard('media', !submitted)
  const router = useRouter()
  const { showToast } = useToast()
  const { state, patch, reset } = useTeacherWizard()
  const supabase = createBrowserClient()

  const [videoMode, setVideoMode] = useState<VideoMode>('url')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoFilePreviewUrl, setVideoFilePreviewUrl] = useState<string | null>(null)
  const [documents, setDocuments] = useState<FileList | null>(null)
  // Only for the video-duration check below -- an inline hint tied to that
  // one field, not a submission-level notification, so it stays as a local
  // message rather than a toast.
  const [videoDurationError, setVideoDurationError] = useState('')
  const [loading, setLoading] = useState(false)

  const trimmedVideoUrl = state.videoUrl.trim()
  const normalizedVideo = trimmedVideoUrl ? normalizeVideoUrl(trimmedVideoUrl) : null
  const videoUrlInvalid = trimmedVideoUrl !== '' && normalizedVideo === null

  // Object URLs for a locally-chosen (not-yet-uploaded) file preview need
  // explicit cleanup, or the browser keeps the file's memory pinned for the
  // lifetime of the tab.
  useEffect(() => {
    if (!videoFile) {
      setVideoFilePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(videoFile)
    setVideoFilePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [videoFile])

  async function uploadVideo(file: File) {
    const { data: session } = await supabase.auth.getUser()
    const userId = session.user?.id
    if (!userId) throw new Error('You must be signed in.')

    const path = `${userId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('teacher-videos').upload(path, file, { upsert: true })
    if (uploadError) throw new Error(uploadError.message)

    const { data } = supabase.storage.from('teacher-videos').getPublicUrl(path)
    return data.publicUrl
  }

  async function uploadDocuments(files: FileList) {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_TEACHER_DOCS || 'teacher-documents'
    const folder = `teacher-documents/${Date.now()}`
    const paths: string[] = []

    for (const file of Array.from(files)) {
      const path = `${folder}/${file.name}`
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      paths.push(path)
    }

    return paths
  }

  async function handleFinish() {
    // nextDisabled already keeps WizardShell from calling this while
    // invalid, but guard here too in case that ever changes.
    if (videoUrlInvalid) return

    setLoading(true)

    try {
      const videoUrl = videoMode === 'upload' && videoFile ? await uploadVideo(videoFile) : normalizedVideo?.embedUrl ?? ''
      const documentPaths = documents ? await uploadDocuments(documents) : []

      const response = await fetch('/api/teacher/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: state.headline,
          bio: state.bio,
          languages: state.languages,
          subjects: state.subjects,
          hourly_rate: Number(state.hourlyRate),
          video_url: videoUrl,
          document_paths: documentPaths,
          start_stripe_onboarding: true,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        showToast('error', data.error || 'Unable to submit onboarding.')
        setLoading(false)
        return
      }

      setSubmitted(true)
      reset()

      if (data.onboardingUrl) {
        // Let the teacher choose now-vs-later on StepPayouts, rather than
        // forcing the Stripe redirect immediately -- patch happens after
        // reset() so it survives on the now-empty wizard state.
        patch({ onboardingUrl: data.onboardingUrl })
        router.push('/teacher/onboarding/payouts')
        return
      }
      router.push('/teacher/dashboard')
    } catch (err: any) {
      showToast('error', err.message || 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <WizardShell
      step="media"
      steps={TEACHER_WIZARD_STEPS}
      title="Add an intro video and documents"
      subtitle="Both are optional, but a video and verified documents help you get approved faster."
      onBack={() => router.push('/teacher/onboarding/rate')}
      onNext={handleFinish}
      nextLabel="Finish"
      nextDisabled={videoUrlInvalid}
      nextLoading={loading}
    >
      <div className="grid gap-6">
        <div>
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            Intro video (optional)
            <InfoTooltip text={VIDEO_HELP_TEXT} />
          </span>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setVideoMode('url')}
              className={clsx(
                'rounded-full border px-4 py-2 text-sm font-medium transition',
                videoMode === 'url' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'
              )}
            >
              Paste a video URL
            </button>
            <button
              type="button"
              onClick={() => setVideoMode('upload')}
              className={clsx(
                'rounded-full border px-4 py-2 text-sm font-medium transition',
                videoMode === 'upload' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'
              )}
            >
              Upload a video
            </button>
          </div>

          <div className="mt-4">
            {videoMode === 'url' ? (
              <>
                <Input
                  label="Video URL"
                  name="videoUrl"
                  type="url"
                  value={state.videoUrl}
                  onChange={(event) => patch({ videoUrl: event.target.value })}
                  placeholder="https://www.youtube.com/watch?v=... or a Google Drive / Vimeo share link"
                />
                {videoUrlInvalid ? (
                  <p className="mt-1 text-xs text-red-600">
                    We only support YouTube, Vimeo, or Google Drive links right now.
                  </p>
                ) : null}
                {normalizedVideo ? (
                  <iframe
                    className="mt-3 h-48 w-full rounded-2xl border border-slate-200"
                    src={normalizedVideo.embedUrl}
                    title="Video preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : null}
              </>
            ) : (
              <div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(event) => {
                    setVideoDurationError('')
                    setVideoFile(event.target.files?.[0] ?? null)
                  }}
                  className="w-full text-sm text-slate-700"
                />
                {videoFile ? <p className="mt-1 text-xs text-slate-500">{videoFile.name}</p> : null}
                {videoFilePreviewUrl ? (
                  <video
                    controls
                    className="mt-3 h-48 w-full rounded-2xl border border-slate-200 bg-slate-950"
                    src={videoFilePreviewUrl}
                    onLoadedMetadata={(event) => {
                      const duration = event.currentTarget.duration
                      if (duration > MAX_VIDEO_SECONDS) {
                        setVideoDurationError(`That video is ${Math.round(duration)}s long — please upload one that's ${MAX_VIDEO_SECONDS} seconds or less.`)
                        setVideoFile(null)
                      }
                    }}
                  />
                ) : null}
                {videoDurationError ? <p className="mt-1 text-xs text-red-600">{videoDurationError}</p> : null}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            This plays directly on your public profile so students can watch it before booking. Keep it to {MAX_VIDEO_SECONDS} seconds or
            less{videoMode === 'upload' ? ' — checked automatically on upload.' : ' — please trim your clip before sharing the link.'}
          </p>
        </div>

        <div>
          <span className="block text-sm font-medium text-slate-700">Verification documents (optional)</span>
          <p className="mt-1 text-xs text-slate-500">
            A government-issued ID and any teaching certificates or diplomas you have. Used only to verify your identity and
            qualifications before approval — never shown publicly. PDF or image files.
          </p>
          <input
            type="file"
            accept="application/pdf,image/*"
            multiple
            onChange={(event) => setDocuments(event.target.files)}
            className="mt-2 w-full text-sm text-slate-700"
          />
        </div>
      </div>
    </WizardShell>
  )
}
