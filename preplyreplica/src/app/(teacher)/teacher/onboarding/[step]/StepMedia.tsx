'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { Input } from '@/components/Input'
import { FormMessage } from '@/components/FormMessage'
import { createBrowserClient } from '@/lib/supabase/client'
import { useTeacherWizard } from '@/components/onboarding/TeacherWizardProvider'
import { useTeacherStepGuard } from '@/components/onboarding/useTeacherStepGuard'
import { TEACHER_WIZARD_STEPS } from './steps'

type VideoMode = 'url' | 'upload'

export function StepMedia() {
  const [submitted, setSubmitted] = useState(false)
  useTeacherStepGuard('media', !submitted)
  const router = useRouter()
  const { state, patch, reset } = useTeacherWizard()
  const supabase = createBrowserClient()

  const [videoMode, setVideoMode] = useState<VideoMode>('url')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [documents, setDocuments] = useState<FileList | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    setError('')
    setLoading(true)

    try {
      const videoUrl = videoMode === 'upload' && videoFile ? await uploadVideo(videoFile) : state.videoUrl
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
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Unable to submit onboarding.')
        setLoading(false)
        return
      }

      setSubmitted(true)
      reset()

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl
        return
      }
      router.push('/teacher/dashboard')
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
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
      nextLoading={loading}
    >
      <div className="grid gap-6">
        <div>
          <span className="block text-sm font-medium text-slate-700">Intro video (optional)</span>
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

          {videoMode === 'url' ? (
            <Input
              label="Video URL"
              name="videoUrl"
              type="url"
              value={state.videoUrl}
              onChange={(event) => patch({ videoUrl: event.target.value })}
              placeholder="https://www.youtube.com/embed/..."
              className="mt-3"
            />
          ) : (
            <div className="mt-3">
              <input
                type="file"
                accept="video/*"
                onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-700"
              />
              {videoFile ? <p className="mt-1 text-xs text-slate-500">{videoFile.name}</p> : null}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">This plays directly on your public profile so students can watch it before booking.</p>
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

        {error ? <FormMessage type="error">{error}</FormMessage> : null}
      </div>
    </WizardShell>
  )
}
