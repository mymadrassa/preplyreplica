import type { MissingItem } from '@/lib/teacherReadiness'

/**
 * The automatic message an admin can send when not approving a profile: what
 * the teacher still has to complete, plus any document that failed its safety
 * check. The admin can edit it or write their own instead.
 */
export function automaticReviewMessage(missing: Pick<MissingItem, 'title' | 'description'>[], suspiciousDocuments: number): string {
  const lines = missing.map((item) => `• ${item.title}: ${item.description}`)
  if (suspiciousDocuments) {
    lines.push(
      `• Upload your document${suspiciousDocuments === 1 ? '' : 's'} again: ${suspiciousDocuments === 1 ? 'one file' : `${suspiciousDocuments} files`} couldn't be accepted. Please use a PDF, JPEG, PNG or WebP file (a scan or a photo).`
    )
  }
  if (!lines.length) return ''
  return `Please complete the following, then submit your profile again:\n${lines.join('\n')}`
}

/** Reasons an admin often gives that no automatic check can see; each adds one line to the message. */
export const COMMON_REJECTION_REASONS: { label: string; line: string }[] = [
  { label: 'ID unreadable', line: 'Your ID document is blurry or cut off. Please upload a clear photo or scan where every detail can be read.' },
  { label: 'Name mismatch', line: 'The name on your ID document doesn’t match the name on your profile. Please make them match.' },
  { label: 'Expired ID', line: 'Your ID document has expired. Please upload a valid one.' },
  { label: 'Unsuitable photo', line: 'Please use a clear, recent photo of your face, on its own, with a neutral background.' },
  { label: 'Contact details in bio', line: 'Please remove personal contact details (phone, email, social media) from your bio: students contact you through the platform.' },
  { label: 'Bio too short', line: 'Please tell students more in your bio: your experience, how you teach and who you teach.' },
  { label: 'Qualifications', line: 'Please add details about your qualifications (ijazah, certificates or studies) and upload any certificate you have.' },
]

/** Adds a reason as a new bullet, starting the message with a greeting line when it's empty. */
export function addReasonLine(message: string, line: string): string {
  const trimmed = message.trim()
  if (trimmed.includes(line)) return message
  const intro = 'Please make the following changes, then submit your profile again:'
  return trimmed ? `${trimmed}\n• ${line}` : `${intro}\n• ${line}`
}
