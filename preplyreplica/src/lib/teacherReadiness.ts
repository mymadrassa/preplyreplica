// The single definition of "what a teacher must finish before submitting for
// approval". The dashboard status bar, the top-bar notifications, the submit
// API and the admin approve check all use this, so they can never disagree.

export const MIN_HOURLY_RATE = 8

export interface TeacherReadinessInput {
  headline: string | null
  bio: string | null
  subjects: string[] | null
  languages: string[] | null
  hourly_rate: number | null
  avatar_url: string | null
  /** Private contact number (profiles.phone), used for lesson homework. */
  phone: string | null
  /** profiles.gender: students only see teachers of their own gender. */
  gender: string | null
  identityDocumentCount: number
  payments_enabled: boolean
}

export interface MissingItem {
  key: 'profile' | 'phone' | 'gender' | 'photo' | 'identity' | 'payouts'
  title: string
  description: string
  href: string
}

export interface TeacherReadiness {
  profile: boolean
  phone: boolean
  gender: boolean
  photo: boolean
  identity: boolean
  payouts: boolean
  canSubmit: boolean
  missing: MissingItem[]
}

/** Same minimums the /api/teacher/onboard schema enforces. */
export function isProfileComplete(t: Pick<TeacherReadinessInput, 'headline' | 'bio' | 'subjects' | 'languages' | 'hourly_rate'>): boolean {
  return (
    (t.headline?.trim().length ?? 0) >= 10 &&
    (t.bio?.trim().length ?? 0) >= 20 &&
    (t.subjects?.length ?? 0) > 0 &&
    (t.languages?.length ?? 0) > 0 &&
    Number(t.hourly_rate) >= MIN_HOURLY_RATE
  )
}

export function getTeacherReadiness(input: TeacherReadinessInput): TeacherReadiness {
  const profile = isProfileComplete(input)
  const phone = !!input.phone
  const gender = !!input.gender
  const photo = !!input.avatar_url
  const identity = input.identityDocumentCount > 0
  const payouts = input.payments_enabled

  const missing: MissingItem[] = []
  if (!profile)
    missing.push({ key: 'profile', title: 'Complete your profile', description: 'Add a headline, bio, subjects, languages and your rate.', href: '/teacher/profile/details' })
  if (!phone)
    missing.push({ key: 'phone', title: 'Add your WhatsApp number', description: 'Private: we contact you on WhatsApp about lessons, never shown to students.', href: '/teacher/profile/details' })
  if (!gender)
    missing.push({ key: 'gender', title: 'Tell us your gender', description: 'Students are matched with teachers of the same gender.', href: '/teacher/profile/details' })
  if (!photo)
    missing.push({ key: 'photo', title: 'Add a profile photo', description: 'Students see it on your profile and when booking.', href: '/teacher/profile/photo' })
  if (!identity)
    missing.push({ key: 'identity', title: 'Upload an ID document', description: 'A passport, ID card or driving licence, so we can verify you.', href: '/teacher/profile/identity' })
  if (!payouts)
    missing.push({ key: 'payouts', title: 'Set up payouts', description: 'Connect a payout account so you can be paid for lessons.', href: '/teacher/profile/payouts' })

  return { profile, phone, gender, photo, identity, payouts, canSubmit: missing.length === 0, missing }
}
