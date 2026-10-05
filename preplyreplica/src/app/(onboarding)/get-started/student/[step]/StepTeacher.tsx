'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { WizardShell } from '@/components/onboarding/WizardShell'
import { RatingStars } from '@/components/RatingStars'
import { useWizard } from '@/components/onboarding/WizardProvider'
import { useStepGuard } from '@/components/onboarding/useStepGuard'

interface RankedTeacher {
  id: string
  full_name: string
  headline: string | null
  rating_avg: number
  hourly_rate: number
  subjects: string[]
  languages: string[]
  score: number
}

export function StepTeacher() {
  useStepGuard('teacher')
  const router = useRouter()
  const { state, patch } = useWizard()
  const [teachers, setTeachers] = useState<RankedTeacher[]>([])
  const [loading, setLoading] = useState(true)
  const loggedImpressions = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (state.courses.length) params.set('courses', state.courses.join(','))
    if (state.weeklySlots.length) params.set('weeklySlots', JSON.stringify(state.weeklySlots))

    fetch(`/api/onboarding/recommend-teachers?${params.toString()}`)
      .then((response) => response.json())
      .then((result) => setTeachers(result.teachers ?? []))
      .finally(() => setLoading(false))
    // Only re-fetch if the inputs that affect ranking change — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (loggedImpressions.current || !teachers.length) return
    loggedImpressions.current = true
    fetch('/api/onboarding/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: teachers.map((teacher, index) => ({ teacherId: teacher.id, eventType: 'impression', score: teacher.score, rank: index })),
      }),
    }).catch(() => {
      // Logging is best-effort — never block the wizard on it.
    })
  }, [teachers])

  function select(teacherId: string) {
    patch({ selectedTeacherId: teacherId })
  }

  function handleNext() {
    router.push('/get-started/student/account')
  }

  return (
    <WizardShell
      step="teacher"
      title="Pick your teacher"
      subtitle="Ranked based on your subjects, availability, and rating."
      onBack={() => router.push('/get-started/student/package')}
      onNext={handleNext}
      nextLabel={state.selectedTeacherId ? 'Continue' : "I'll choose later"}
    >
      {loading ? (
        <p className="text-slate-500">Finding teachers for you…</p>
      ) : teachers.length ? (
        <div className="grid gap-3">
          {teachers.map((teacher) => (
            <button
              key={teacher.id}
              type="button"
              onClick={() => select(teacher.id)}
              aria-pressed={state.selectedTeacherId === teacher.id}
              className={clsx(
                'w-full rounded-2xl border p-4 text-left shadow-card transition-all hover:-translate-y-px hover:shadow-lift',
                state.selectedTeacherId === teacher.id ? 'border-brand-600 ring-2 ring-brand-600 bg-brand-50' : 'border-slate-200/80 bg-white'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{teacher.full_name}</p>
                  <p className="mt-1 text-sm text-slate-600">{teacher.headline}</p>
                </div>
                <span className="font-semibold text-slate-900">£{teacher.hourly_rate}/hr</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <RatingStars value={teacher.rating_avg} />
                {teacher.subjects.length ? <span className="text-sm text-slate-500">{teacher.subjects.slice(0, 3).join(', ')}</span> : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
          No teachers match yet — you can still create your account and browse the full catalog afterwards.
        </p>
      )}
    </WizardShell>
  )
}
