'use client'

import Link from 'next/link'
import { CalendarPlus, Video, X } from 'lucide-react'
import { BookingActions } from '@/components/BookingActions'
import { StatusBadge } from '@/components/StatusBadge'
import { BOOKING_STATUS_LABELS, formatBookingDateTime } from '@/lib/format'

interface BookingDetailModalProps {
  bookingId: string
  subject: string
  studentName: string
  startAt: string
  endAt: string
  status: string
  teacherConfirmedAt: string | null
  isTrial?: boolean
  onClose: () => void
  /** Fired (before onClose) when approve/reject/mark-complete succeeds, so the caller can react to which one happened — e.g. keep a just-declined booking visible as "Refused" for the rest of the session. */
  onActionSuccess?: (action: 'approve' | 'reject' | 'complete') => void
}

/**
 * One place to see everything about a booked session and act on it —
 * replaces separately navigating to /session/[id] to "view" a booking, and
 * unifies what used to be two different small popovers (accept/decline vs.
 * confirm-completed) into a single centered dialog whose action area just
 * adapts to the booking's current status.
 */
export function BookingDetailModal({ bookingId, subject, studentName, startAt, endAt, status, teacherConfirmedAt, isTrial, onClose, onActionSuccess }: BookingDetailModalProps) {
  const hasEnded = new Date(endAt) <= new Date()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              {subject}
              {isTrial ? <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">Trial</span> : null}
            </p>
            <p className="text-sm text-slate-500">{studentName}</p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">{formatBookingDateTime(startAt)}</p>
          <StatusBadge status={status} label={BOOKING_STATUS_LABELS[status] ?? status} />
        </div>

        {status === 'pending_payment' ? (
          <p className="text-sm text-slate-500">The student's payment is still processing — this will update on its own once it's confirmed, and you'll be able to approve it here.</p>
        ) : null}

        {status === 'confirmed' && !hasEnded ? (
          <div className="flex gap-3">
            <Link
              href={`/session/${bookingId}`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <Video className="h-4 w-4" aria-hidden="true" /> Join session
            </Link>
            <a
              href={`/api/bookings/${bookingId}/calendar`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
            </a>
          </div>
        ) : null}

        {status === 'pending' || (status === 'confirmed' && hasEnded) ? (
          <BookingActions
            bookingId={bookingId}
            status={status}
            endAt={endAt}
            teacherConfirmedAt={teacherConfirmedAt}
            onSuccess={(action) => {
              onActionSuccess?.(action)
              onClose()
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
