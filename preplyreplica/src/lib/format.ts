// Shared display formatting for booking data — used anywhere a booking's
// date/time or status needs to read as English prose rather than a raw
// ISO string or enum value (student dashboard, student bookings list, etc.).

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Payment processing',
  pending: 'Awaiting approval',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Declined',
}

/** e.g. "Tue, 18 Aug 2026, 12:00 pm" — explicit 12-hour clock, since en-GB's locale default is 24-hour. */
export function formatBookingDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
