import { redirect } from 'next/navigation'

const MOVED: Record<string, string> = { photo: 'photo', identity: 'identity', certificates: 'certificates', review: 'review' }

// The verification steps are now part of the Profile page.
export default function TeacherVerificationStep({ params }: { params: { step: string } }) {
  redirect(`/teacher/profile/${MOVED[params.step] ?? 'photo'}`)
}
