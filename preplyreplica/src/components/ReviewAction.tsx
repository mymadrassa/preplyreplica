'use client'

import { useState } from 'react'
import { Star, X } from 'lucide-react'
import { RatingStars } from '@/components/RatingStars'
import { Input } from '@/components/Input'
import { TextArea } from '@/components/TextArea'
import { SubmitButton } from '@/components/SubmitButton'

interface ExistingReview {
  rating: number
  comment: string | null
}

interface ReviewActionProps {
  bookingId: string
  teacherId: string
  existingReview?: ExistingReview | null
  submitAction: (formData: FormData) => void | Promise<void>
}

/** Compact "leave a review" trigger + popover for a completed booking — shows a static rating instead once one exists, rather than re-showing the form. */
export function ReviewAction({ bookingId, teacherId, existingReview, submitAction }: ReviewActionProps) {
  const [popover, setPopover] = useState<{ x: number; y: number } | null>(null)

  if (existingReview) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <RatingStars value={existingReview.rating} />
        Reviewed
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => setPopover({ x: event.clientX, y: event.clientY })}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
      >
        <Star className="h-4 w-4" aria-hidden="true" />
        Leave a review
      </button>

      {popover ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopover(null)} />
          <div
            className="fixed z-50 w-72 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl"
            style={{ left: Math.min(popover.x, window.innerWidth - 300), top: Math.min(popover.y, window.innerHeight - 320) }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Leave a review</p>
              <button type="button" onClick={() => setPopover(null)} className="cursor-pointer text-slate-400 hover:text-slate-600" aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form action={submitAction} onSubmit={() => setPopover(null)} className="space-y-3">
              <input type="hidden" name="bookingId" value={bookingId} />
              <input type="hidden" name="teacherId" value={teacherId} />
              <Input label="Rating (1-5)" name="rating" type="number" min={1} max={5} required />
              <TextArea label="Comment" name="comment" rows={2} />
              <SubmitButton className="w-full">Submit review</SubmitButton>
            </form>
          </div>
        </>
      ) : null}
    </>
  )
}
