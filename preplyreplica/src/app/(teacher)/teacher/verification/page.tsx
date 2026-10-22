import { redirect } from 'next/navigation'

// The verification steps are now part of the Profile page.
export default function TeacherVerificationIndex() {
  redirect('/teacher/profile/photo')
}
