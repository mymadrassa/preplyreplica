import type { ReportResolution } from '@/types/database'

// Wording for reported lessons, shared by the admin pages and the lesson lists.

export const RESOLUTION_LABELS: Record<ReportResolution, string> = {
  pay_teacher: 'Teacher paid',
  refund_student: 'Student refunded',
  refund_partial: 'Partly refunded',
}

/** What the reporter's side sees about their report in their lesson list. */
export function reportStatusLabel(report: { status: 'open' | 'resolved'; resolution: ReportResolution | null }): string {
  if (report.status === 'open') return 'Problem reported · under review'
  return report.resolution ? `Report closed · ${RESOLUTION_LABELS[report.resolution]}` : 'Report closed'
}
