// /Users/ybdn95/Desktop/preplyreplica/preplyreplica/src/components/TeacherOnboardingForm.tsx
'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { TextArea } from '@/components/TextArea'

export function TeacherOnboardingForm({ existingProfile }: any) {
  const supabase = createBrowserClient()
  const [headline, setHeadline] = useState(existingProfile?.headline || '')
  const [bio, setBio] = useState(existingProfile?.bio || '')
  const [languages, setLanguages] = useState((existingProfile?.languages || ['English']).join(','))
  const [subjects, setSubjects] = useState((existingProfile?.subjects || ['English']).join(','))
  const [hourlyRate, setHourlyRate] = useState(existingProfile?.hourly_rate?.toString() || '25')
  const [videoUrl, setVideoUrl] = useState(existingProfile?.video_url || '')
  const [documents, setDocuments] = useState<FileList | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const documentPaths = documents ? await uploadDocuments(documents) : []
      const response = await fetch('/api/teacher/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline,
          bio,
          languages: languages.split(',').map((item) => item.trim()).filter(Boolean),
          subjects: subjects.split(',').map((item) => item.trim()).filter(Boolean),
          hourly_rate: Number(hourlyRate),
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

      window.location.href = data.onboardingUrl
    } catch (err: any) {
      setError(err.message || 'Upload failed.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Headline" name="headline" value={headline} onChange={(event) => setHeadline(event.target.value)} required />
      <TextArea label="Bio" name="bio" rows={5} value={bio} onChange={(event) => setBio(event.target.value)} required />
      <Input label="Languages" name="languages" value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder="English, Spanish" required />
      <Input label="Subjects" name="subjects" value={subjects} onChange={(event) => setSubjects(event.target.value)} placeholder="Math, Physics" required />
      <Input label="Hourly rate" name="hourlyRate" type="number" min={10} value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} required />
      <Input label="Video URL" name="videoUrl" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} />
      <div>
        <label className="block text-sm font-medium text-slate-700">Upload documents</label>
        <input type="file" accept="application/pdf,image/*" multiple onChange={(event) => setDocuments(event.target.files)} className="mt-2 w-full text-sm text-slate-700" />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
      <Button type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Save and continue Stripe onboarding'}</Button>
    </form>
  )
}
